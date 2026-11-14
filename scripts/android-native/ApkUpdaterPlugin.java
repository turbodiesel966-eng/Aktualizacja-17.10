package pl.turbodiesel.naprawnik;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String ALLOWED_DOWNLOAD_PREFIX = "https://naprawnik-download.pages.dev/";
    private static final String UPDATES_SUBDIR = "updates";
    private static final String APK_FILENAME = "naprawnik-update.apk";
    private static final String PART_FILENAME = "naprawnik-update.apk.part";
    private static final long MIN_APK_BYTES = 100_000L;
    private static final long EXTRA_FREE_SPACE_BYTES = 15L * 1024L * 1024L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadCancelled = new AtomicBoolean(false);
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);

    @PluginMethod
    public void getInstalledInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            String pkg = ctx.getPackageName();
            PackageInfo pInfo = getPackageInfoCompat(pm, pkg, false);

            JSObject ret = new JSObject();
            ret.put("packageName", pkg);
            ret.put("versionName", pInfo.versionName != null ? pInfo.versionName : "0.0");
            ret.put("versionCode", PackageInfoCompat.getLongVersionCode(pInfo));
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            ret.put("canRequestPackageInstalls", canInstallPackagesCompat(ctx));

            Set<String> sigs = extractSignatureDigests(getPackageInfoCompat(pm, pkg, true));
            if (!sigs.isEmpty()) {
                ret.put("signatureSha256", sigs.iterator().next());
            }

            File verifiedApk = getVerifiedApkFile(ctx);
            ret.put("hasDownloadedApk", verifiedApk.isFile() && verifiedApk.length() >= MIN_APK_BYTES);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Błąd odczytu wersji aplikacji: " + e.getMessage(), "INFO_ERROR", e);
        }
    }

    @PluginMethod
    public void fetchUpdateMetadata(PluginCall call) {
        String urlString = call.getString("url", "");
        if (urlString == null || !urlString.startsWith(ALLOWED_DOWNLOAD_PREFIX)) {
            call.reject("Nieprawidłowy lub nieoficjalny adres manifestu aktualizacji.", "UNTRUSTED_URL");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setUseCaches(false);
                conn.setDefaultUseCaches(false);
                conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
                conn.setRequestProperty("Pragma", "no-cache");
                conn.setRequestProperty("User-Agent", "NAPRAWNIK-Android-Updater/1.0");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.connect();

                int status = conn.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) {
                    call.reject("Serwer aktualizacji zwrócił błąd HTTP " + status, "HTTP_ERROR");
                    return;
                }

                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int read;
                try (InputStream in = new BufferedInputStream(conn.getInputStream())) {
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                }
                String jsonStr = out.toString("UTF-8");
                JSObject ret = new JSObject(jsonStr);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Błąd pobierania manifestu aktualizacji: " + e.getMessage(), "NETWORK_ERROR", e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        downloadCancelled.set(true);
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadAndVerifyApk(PluginCall call) {
        String apkUrl = call.getString("url", "");
        String expectedSha256 = call.getString("expectedSha256", "");
        long expectedSize = call.getLong("expectedSize", 0L);
        String expectedPkg = call.getString("expectedPackageName", getContext().getPackageName());

        if (apkUrl == null || !apkUrl.startsWith(ALLOWED_DOWNLOAD_PREFIX)) {
            call.reject("Nieprawidłowy lub nieoficjalny adres pobierania APK.", "UNTRUSTED_URL");
            return;
        }
        if (!downloadInProgress.compareAndSet(false, true)) {
            call.reject("Pobieranie aktualizacji jest już w toku.", "DOWNLOAD_BUSY");
            return;
        }

        downloadCancelled.set(false);
        executor.execute(() -> {
            HttpURLConnection conn = null;
            File updatesDir = new File(getContext().getCacheDir(), UPDATES_SUBDIR);
            File partFile = new File(updatesDir, PART_FILENAME);
            File finalFile = new File(updatesDir, APK_FILENAME);

            try {
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new UpdaterException("STORAGE_ERROR", "Nie można utworzyć katalogu tymczasowego aktualizacji.");
                }
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }

                URL url = new URL(apkUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setUseCaches(false);
                conn.setRequestProperty("Cache-Control", "no-cache, no-store");
                conn.setRequestProperty("User-Agent", "NAPRAWNIK-Android-Updater/1.0");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();

                int status = conn.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) {
                    throw new UpdaterException("SERVER_ERROR", "Serwer zwrócił błąd HTTP " + status + " podczas pobierania APK.");
                }

                long contentLength = conn.getContentLengthLong();
                long requiredSpace = (contentLength > 0 ? contentLength : Math.max(expectedSize, 15L * 1024L * 1024L)) + EXTRA_FREE_SPACE_BYTES;
                if (updatesDir.getUsableSpace() < requiredSpace) {
                    throw new UpdaterException("INSUFFICIENT_STORAGE", "Brak wystarczającego miejsca w pamięci urządzenia do pobrania aktualizacji.");
                }

                MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
                long downloaded = 0L;
                long lastNotifyTime = 0L;
                byte[] buffer = new byte[16384];

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(partFile)) {
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        if (downloadCancelled.get()) {
                            throw new UpdaterException("DOWNLOAD_CANCELLED", "Pobieranie aktualizacji zostało przerwane przez użytkownika.");
                        }
                        out.write(buffer, 0, bytesRead);
                        sha256.update(buffer, 0, bytesRead);
                        downloaded += bytesRead;

                        long now = System.currentTimeMillis();
                        if (now - lastNotifyTime >= 220L || (contentLength > 0 && downloaded >= contentLength)) {
                            lastNotifyTime = now;
                            JSObject progress = new JSObject();
                            progress.put("downloadedBytes", downloaded);
                            progress.put("totalBytes", contentLength > 0 ? contentLength : expectedSize);
                            int pct = 0;
                            long denom = contentLength > 0 ? contentLength : expectedSize;
                            if (denom > 0) {
                                pct = (int) Math.min(100L, Math.round((downloaded * 100.0) / denom));
                            }
                            progress.put("percent", pct);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                    out.flush();
                }

                long actualSize = partFile.length();
                if (actualSize < MIN_APK_BYTES) {
                    throw new UpdaterException("INVALID_APK", "Pobrany plik jest za mały lub niekompletny (" + actualSize + " B).");
                }
                if (expectedSize > 0 && actualSize != expectedSize) {
                    throw new UpdaterException("SIZE_MISMATCH", "Rozmiar pobranego pliku (" + actualSize + " B) nie zgadza się z oczekiwanym (" + expectedSize + " B).");
                }

                String actualSha256 = bytesToHex(sha256.digest());
                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                    if (!actualSha256.equalsIgnoreCase(expectedSha256.trim())) {
                        throw new UpdaterException("SHA256_MISMATCH", "Suma kontrolna SHA-256 pobranego pliku jest niezgodna. Instalacja przerwana ze względów bezpieczeństwa.");
                    }
                }

                // Weryfikacja struktury APK, packageName, versionCode oraz podpisu cyfrowego
                PackageManager pm = getContext().getPackageManager();
                PackageInfo archiveInfo = getArchiveInfoCompat(pm, partFile.getAbsolutePath());
                if (archiveInfo == null || archiveInfo.packageName == null) {
                    throw new UpdaterException("INVALID_APK", "Pobrany plik nie jest prawidłowym pakietem instalacyjnym Android APK.");
                }

                String installedPkg = getContext().getPackageName();
                if (!installedPkg.equals(archiveInfo.packageName) || (expectedPkg != null && !expectedPkg.equals(archiveInfo.packageName))) {
                    throw new UpdaterException("PACKAGE_MISMATCH", "Niezgodność identyfikatora aplikacji w pliku APK (" + archiveInfo.packageName + " zamiast " + installedPkg + ").");
                }

                PackageInfo currentInfo = getPackageInfoCompat(pm, installedPkg, true);
                long installedVersionCode = PackageInfoCompat.getLongVersionCode(currentInfo);
                long apkVersionCode = PackageInfoCompat.getLongVersionCode(archiveInfo);

                if (apkVersionCode <= installedVersionCode) {
                    throw new UpdaterException("OLDER_OR_SAME_VERSION", "Pobrana wersja (" + apkVersionCode + ") nie jest nowsza od obecnie zainstalowanej (" + installedVersionCode + ").");
                }

                Set<String> installedSigs = extractSignatureDigests(currentInfo);
                Set<String> apkSigs = extractSignatureDigests(archiveInfo);
                if (apkSigs.isEmpty()) {
                    throw new UpdaterException("SIGNATURE_MISMATCH", "Pobrany plik APK nie zawiera ważnego podpisu cyfrowego.");
                }
                if (!installedSigs.isEmpty()) {
                    boolean matches = false;
                    for (String sig : apkSigs) {
                        if (installedSigs.contains(sig)) {
                            matches = true;
                            break;
                        }
                    }
                    if (!matches) {
                        throw new UpdaterException("SIGNATURE_MISMATCH", "Niezgodny podpis cyfrowy pobranego APK. Aktualizacja z innym kluczem wymagałaby odinstalowania aplikacji i groziłaby utratą danych.");
                    }
                }

                if (finalFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    finalFile.delete();
                }
                if (!partFile.renameTo(finalFile)) {
                    throw new UpdaterException("STORAGE_ERROR", "Nie udało się zapisać zweryfikowanego pliku APK.");
                }

                JSObject res = new JSObject();
                res.put("verified", true);
                res.put("sha256", actualSha256);
                res.put("size", actualSize);
                res.put("packageName", archiveInfo.packageName);
                res.put("versionName", archiveInfo.versionName != null ? archiveInfo.versionName : "");
                res.put("versionCode", apkVersionCode);
                call.resolve(res);
            } catch (UpdaterException ue) {
                cleanupPartFile(partFile);
                call.reject(ue.getMessage(), ue.code, ue);
            } catch (java.net.UnknownHostException | java.net.ConnectException | java.net.SocketTimeoutException netEx) {
                cleanupPartFile(partFile);
                call.reject("Brak połączenia z serwerem aktualizacji lub połączenie zostało przerwane.", "NETWORK_ERROR", netEx);
            } catch (Exception ex) {
                cleanupPartFile(partFile);
                call.reject("Pobieranie zostało przerwane: " + ex.getMessage(), "DOWNLOAD_INTERRUPTED", ex);
            } finally {
                if (conn != null) conn.disconnect();
                downloadInProgress.set(false);
            }
        });
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                startActivityForResult(call, intent, "handlePermissionSettingsResult");
            } else {
                JSObject ret = new JSObject();
                ret.put("canInstall", true);
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Nie można otworzyć ustawień uprawnień instalacji: " + e.getMessage(), "SETTINGS_ERROR", e);
        }
    }

    @ActivityCallback
    protected void handlePermissionSettingsResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        ret.put("canInstall", canInstallPackagesCompat(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void installVerifiedApk(PluginCall call) {
        try {
            Context ctx = getContext();
            if (!canInstallPackagesCompat(ctx)) {
                JSObject ret = new JSObject();
                ret.put("permissionRequired", true);
                call.resolve(ret);
                return;
            }

            File apkFile = getVerifiedApkFile(ctx);
            if (!apkFile.isFile() || apkFile.length() < MIN_APK_BYTES) {
                call.reject("Brak zweryfikowanego pliku aktualizacji. Pobierz aktualizację ponownie.", "APK_MISSING");
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".apkupdater.provider", apkFile);
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            intent.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, ctx.getPackageName());

            try {
                startActivityForResult(call, intent, "handleInstallResult");
            } catch (android.content.ActivityNotFoundException noInstaller) {
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                viewIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivityForResult(call, viewIntent, "handleInstallResult");
            }
        } catch (Exception e) {
            call.reject("Nie udało się uruchomić systemowego instalatora Androida: " + e.getMessage(), "INSTALL_ERROR", e);
        }
    }

    @ActivityCallback
    protected void handleInstallResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        int code = result != null ? result.getResultCode() : Activity.RESULT_CANCELED;
        ret.put("launched", true);
        ret.put("resultCode", code);
        ret.put("cancelled", code == Activity.RESULT_CANCELED);
        ret.put("ok", code == Activity.RESULT_OK);
        call.resolve(ret);
    }

    private static File getVerifiedApkFile(Context ctx) {
        return new File(new File(ctx.getCacheDir(), UPDATES_SUBDIR), APK_FILENAME);
    }

    private static void cleanupPartFile(File f) {
        if (f != null && f.exists()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }

    private static boolean canInstallPackagesCompat(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return ctx.getPackageManager().canRequestPackageInstalls();
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getPackageInfoCompat(PackageManager pm, String pkg, boolean withSignatures) throws PackageManager.NameNotFoundException {
        int flags = 0;
        if (withSignatures) {
            flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        }
        return pm.getPackageInfo(pkg, flags);
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getArchiveInfoCompat(PackageManager pm, String filePath) {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
        PackageInfo info = pm.getPackageArchiveInfo(filePath, flags);
        if (info == null && flags != 0) {
            info = pm.getPackageArchiveInfo(filePath, 0);
        }
        if (info != null && info.applicationInfo != null) {
            info.applicationInfo.sourceDir = filePath;
            info.applicationInfo.publicSourceDir = filePath;
        }
        return info;
    }

    @SuppressWarnings("deprecation")
    private static Set<String> extractSignatureDigests(PackageInfo info) {
        Set<String> digests = new HashSet<>();
        if (info == null) return digests;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            Signature[] sigs = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
                sigs = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
            }
            if ((sigs == null || sigs.length == 0) && info.signatures != null) {
                sigs = info.signatures;
            }
            if (sigs != null) {
                for (Signature s : sigs) {
                    if (s != null) {
                        digests.add(bytesToHex(md.digest(s.toByteArray())));
                        md.reset();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return digests;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.US, "%02x", b));
        }
        return sb.toString();
    }

    private static final class UpdaterException extends Exception {
        final String code;
        UpdaterException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
