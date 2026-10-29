/* NAPRAWNIK — APK-only workshop calculators. No network/API calls. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.mount(root.document);
  if (root) root.NaprawnikWorkshopCalculators = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const finitePositive = (value, label) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(label + ': wpisz liczbę większą od zera.');
    return n;
  };
  function oilMlPerLiter(ratio) {
    return Math.round(1000 / finitePositive(ratio, 'Proporcja') * 100) / 100;
  }
  function oilAmountMl(fuelLiters, ratio) {
    return Math.round(finitePositive(fuelLiters, 'Paliwo') * oilMlPerLiter(ratio) * 100) / 100;
  }
  function displacementCc(boreMm, strokeMm, cylinders) {
    const bore = finitePositive(boreMm, 'Średnica');
    const stroke = finitePositive(strokeMm, 'Skok');
    const count = finitePositive(cylinders, 'Liczba cylindrów');
    if (![1,2,3,4,6,8].includes(count)) throw new Error('Liczba cylindrów: wybierz 1, 2, 3, 4, 6 albo 8.');
    return Math.round((Math.PI / 4 * bore * bore * stroke * count / 1000) * 100) / 100;
  }
  function ratioResult(frontTeeth, rearTeeth) {
    return Math.round((finitePositive(rearTeeth, 'Zęby z tyłu') / finitePositive(frontTeeth, 'Zęby z przodu')) * 1000) / 1000;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function mount(doc) {
    if (!doc || doc.getElementById('npWorkshopCalcLauncher')) return;
    const style = doc.createElement('style');
    style.textContent = '#npWorkshopCalcLauncher{position:fixed;right:14px;bottom:78px;z-index:9998;border:1px solid #ff8c1a;background:#15151f;color:#ffb45e;border-radius:12px;padding:12px;font:bold 13px monospace;box-shadow:0 3px 14px #0009}#npWorkshopCalcPanel{position:fixed;inset:10% 4% auto;max-height:80vh;overflow:auto;z-index:9999;background:#10101a;color:#eee;border:1px solid #ff8c1a;border-radius:14px;padding:16px;font:14px monospace;box-shadow:0 0 0 100vmax #0009}#npWorkshopCalcPanel[hidden]{display:none}#npWorkshopCalcPanel label{display:block;margin:10px 0 4px;color:#9eefff}#npWorkshopCalcPanel input,#npWorkshopCalcPanel select{width:100%;padding:10px;background:#20202d;color:#fff;border:1px solid #555;border-radius:7px;font:inherit}#npWorkshopCalcPanel button{margin:10px 5px 0 0;padding:10px;border:1px solid #ff8c1a;border-radius:7px;background:#252535;color:#fff;font:inherit}#npWorkshopCalcResult{padding:12px;margin-top:10px;background:#20202d;border-radius:8px;white-space:pre-line}';
    doc.head.appendChild(style);
    const launch = doc.createElement('button');
    launch.id = 'npWorkshopCalcLauncher'; launch.type = 'button'; launch.textContent = '🧮 KALKULATORY';
    launch.setAttribute('aria-label','Otwórz kalkulatory warsztatowe');
    const panel = doc.createElement('section'); panel.id = 'npWorkshopCalcPanel'; panel.hidden = true;
    panel.innerHTML = '<h2>Kalkulatory warsztatowe</h2><p>Wyniki orientacyjne. Dane serwisowe i proporcje zawsze potwierdź w instrukcji producenta.</p><label for="npCalcType">Kalkulator</label><select id="npCalcType"><option value="oil">Mieszanka paliwo/olej 2T</option><option value="cc">Pojemność skokowa</option><option value="gear">Przełożenie łańcuchowe</option></select><div id="npCalcInputs"></div><div id="npWorkshopCalcResult" role="status" aria-live="polite">Wprowadź dane i wybierz „Oblicz”.</div><button id="npCalcRun" type="button">Oblicz</button><button id="npCalcClose" type="button">Zamknij</button>';
    doc.body.append(launch, panel);
    const inputs = panel.querySelector('#npCalcInputs');
    const result = panel.querySelector('#npWorkshopCalcResult');
    function renderInputs() {
      const type = panel.querySelector('#npCalcType').value;
      const fields = type === 'oil'
        ? [['npCalcFuel','Paliwo (l)','5'],['npCalcRatio','Proporcja 1:X','50']]
        : type === 'cc'
          ? [['npCalcBore','Średnica cylindra (mm)','40'],['npCalcStroke','Skok tłoka (mm)','39'],['npCalcCyl','Liczba cylindrów','1']]
          : [['npCalcFront','Zęby z przodu','14'],['npCalcRear','Zęby z tyłu','52']];
      inputs.innerHTML = fields.map(f => '<label for="'+f[0]+'">'+f[1]+'</label><input id="'+f[0]+'" type="number" min="0.01" step="any" value="'+esc(f[2])+'">').join('');
    }
    panel.querySelector('#npCalcType').addEventListener('change', renderInputs);
    panel.querySelector('#npCalcClose').addEventListener('click', () => { panel.hidden = true; });
    launch.addEventListener('click', () => { panel.hidden = false; });
    panel.querySelector('#npCalcRun').addEventListener('click', () => {
      try {
        const val = id => panel.querySelector('#'+id).value;
        const type = panel.querySelector('#npCalcType').value;
        if (type === 'oil') result.textContent = 'Olej: ' + oilAmountMl(val('npCalcFuel'), val('npCalcRatio')).toLocaleString('pl-PL') + ' ml\nNa 1 litr paliwa: ' + oilMlPerLiter(val('npCalcRatio')).toLocaleString('pl-PL') + ' ml.\nSprawdź proporcję zalecaną przez producenta silnika i oleju.';
        else if (type === 'cc') result.textContent = 'Pojemność geometryczna: ' + displacementCc(val('npCalcBore'), val('npCalcStroke'), val('npCalcCyl')).toLocaleString('pl-PL') + ' cm³.';
        else result.textContent = 'Przełożenie końcowe: ' + ratioResult(val('npCalcFront'), val('npCalcRear')).toLocaleString('pl-PL') + ':1 (liczba zębów tył/przód). Większa wartość zwykle oznacza krótsze przełożenie.';
      } catch (error) { result.textContent = error.message; }
    });
    renderInputs();
  }
  return { oilMlPerLiter, oilAmountMl, displacementCc, ratioResult, mount };
});
