const C = {
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    div: (a, b) => {
        const denom = b.re * b.re + b.im * b.im;
        return {
            re: (a.re * b.re + a.im * b.im) / denom,
            im: (a.im * b.re - a.re * b.im) / denom
        };
    },
    mag: (z) => Math.sqrt(z.re * z.re + z.im * z.im),
    phase: (z) => Math.atan2(z.im, z.re)
};

function findRoots(coeffs) {
    const n = coeffs.length - 1;
    if (n < 1) return [];
    
    const normCoeffs = coeffs.map(c => ({ re: c / coeffs[0], im: 0 }));
    
    let roots = [];
    for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n;
        roots.push({ re: 0.4 * Math.cos(angle), im: 0.9 * Math.sin(angle) });
    }

    const maxIter = 50;
    for (let iter = 0; iter < maxIter; iter++) {
        let maxDelta = 0;
        for (let i = 0; i < n; i++) {
            let pVal = normCoeffs[0];
            for (let j = 1; j <= n; j++) {
                pVal = C.add(C.mul(pVal, roots[i]), normCoeffs[j]);
            }

            let prod = { re: 1, im: 0 };
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    prod = C.mul(prod, C.sub(roots[i], roots[j]));
                }
            }

            const delta = C.div(pVal, prod);
            roots[i] = C.sub(roots[i], delta);
            
            const mag = C.mag(delta);
            if (mag > maxDelta) maxDelta = mag;
        }
        if (maxDelta < 1e-6) break;
    }
    return roots;
}

let simulationTimeout;
const DEBOUNCE_DELAY = 250;

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        Ra: document.getElementById('Ra'),
        La: document.getElementById('La'),
        Kt: document.getElementById('Kt'),
        Kb: document.getElementById('Kb'),
        J: document.getElementById('J'),
        b: document.getElementById('b'),

        RaValue: document.getElementById('Ra-value'),
        LaValue: document.getElementById('La-value'),
        KtValue: document.getElementById('Kt-value'),
        KbValue: document.getElementById('Kb-value'),
        JValue: document.getElementById('J-value'),
        bValue: document.getElementById('b-value'),
        
        derivedK: document.getElementById('derived-K'),
        derivedOmega: document.getElementById('derived-omega'),
        derivedZeta: document.getElementById('derived-zeta'),
        
        plantType: document.getElementById('plant-type'),
        setpoint: document.getElementById('setpoint'),
        setpointUnit: document.getElementById('setpoint-unit'),
        Kp: document.getElementById('Kp'),
        Ki: document.getElementById('Ki'),
        Kd: document.getElementById('Kd'),
        KpValue: document.getElementById('Kp-value'),
        KiValue: document.getElementById('Ki-value'),
        KdValue: document.getElementById('Kd-value'),

        valTr: document.getElementById('val-tr'),
        valTs: document.getElementById('val-ts'),
        valOs: document.getElementById('val-os'),
        valEss: document.getElementById('val-ess'),

        valPoles: document.getElementById('val-poles'),
        valStatusCl: document.getElementById('val-status-cl'),
        toggleStability: document.getElementById('toggle-stability'),
        stabilitySection: document.getElementById('stability-section'),
        
        pidEnable: document.getElementById('pid-enable'),
        pidParameters: document.getElementById('pid-parameters'),
        setpointLabel: document.querySelector('label[for="setpoint"]'),
        toggleTfButton: document.getElementById('toggle-tf'),

        Kf: document.getElementById('Kf'),
        KfValue: document.getElementById('Kf-value'),
        Vmax: document.getElementById('Vmax'),
        VmaxValue: document.getElementById('Vmax-value'),

        TL: document.getElementById('TL'),
        TLValue: document.getElementById('TL-value'),

        Cth: document.getElementById('Cth'),
        hA: document.getElementById('hA'),

        plotBodeContainer: document.getElementById('plot-bode-container'),
        plotStabilityContainer: document.getElementById('plot-stability-container'),

        toggleRobust: document.getElementById('toggle-robust'),
        robustSection: document.getElementById('robust-section'),

        tSim: document.getElementById('t-sim'),
        dtSim: document.getElementById('dt-sim'),
        runButton: document.getElementById('run-button'),

        plotContainer: document.getElementById('plot-container'),
        plotControlContainer: document.getElementById('plot-control-container'),
        animationContainer: document.getElementById('animation-container'),
        motorCanvas: document.getElementById('motor-canvas'),
        tfContainer: document.getElementById('transfer-function'),
        analysisContainer: document.getElementById('analysis-container'),

        toggleAnimation: document.getElementById('toggle-animation'),
        toggleAnalysis: document.getElementById('toggle-analysis'),

        modalButtons: document.querySelectorAll('.modal-button'),
        closeButtons: document.querySelectorAll('.close-btn'),
    };

    let currentSimulationData = {};
    
    const colorPrimary = 'rgb(0, 170, 255)';
    const colorSecondary = 'rgb(0, 199, 255)';
    const colorDanger = 'rgb(255, 77, 77)';
    const colorWarn = 'rgb(255, 165, 0)';
    const colorGrid = 'rgba(74, 74, 74, 0.5)';
    const colorText = '#d4d4d4';
    const fontMain = "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif";
    const fontMono = "'Consolas', 'Menlo', 'Courier New', monospace";

    function updateSetpointLabel() {
        const isPID = elements.pidEnable.checked;
        if (isPID) {
            const unit = elements.plantType.value === '1' ? 'rad/s' : 'rad';
            elements.setpointUnit.textContent = unit;
            elements.setpointLabel.textContent = 'Setpoint:';
        }
        else {
            elements.setpointUnit.textContent = 'Volt';
            elements.setpointLabel.textContent = 'Tegangan Masukan (V):';
        }
    }

    function setupEventListeners() {
        elements.pidEnable.addEventListener('change', () => {
            const isPIDEnabled = elements.pidEnable.checked;
            if (isPIDEnabled) {
                elements.pidParameters.classList.remove('disabled');
            }
            else {
                elements.pidParameters.classList.add('disabled');
            }
            updateSetpointLabel();
            updateSimulator(true);
        });

        elements.plantType.addEventListener('change', () => {
            updateSetpointLabel();
            updateSimulator(true);
        });
        
        const allSliders = document.querySelectorAll('.slider');
        const allTextBoxes = document.querySelectorAll('.slider-value'); 

        allSliders.forEach(slider => {
            slider.addEventListener('input', () => {
                const textBox = document.getElementById(`${slider.id}-value`); 
                if (textBox) {
                    const precision = slider.step.split('.')[1]?.length || 0;
                    textBox.value = parseFloat(slider.value).toFixed(precision); 
                }
                clearTimeout(simulationTimeout);
                simulationTimeout = setTimeout(() => {
                    updateSimulator(true);
                }, DEBOUNCE_DELAY);
            });
        });

        allTextBoxes.forEach(textBox => {
            textBox.addEventListener('change', () => {
                const sliderId = textBox.id.replace('-value', '');
                const slider = document.getElementById(sliderId);
                
                let value = parseFloat(textBox.value);
                
                if (isNaN(value)) {
                    textBox.value = slider.value;
                    return; 
                }

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const step = slider.step;

                if (value < min) value = min;
                if (value > max) value = max;

                const precision = step.split('.')[1]?.length || 0;

                slider.value = value.toFixed(precision);
                textBox.value = slider.value; 
                
                clearTimeout(simulationTimeout);
                simulationTimeout = setTimeout(() => {
                    updateSimulator(true);
                }, DEBOUNCE_DELAY);
            });
        });

        elements.setpoint.addEventListener('input', () => updateSimulator(true));
        elements.tSim.addEventListener('input', () => updateSimulator(true));
        elements.dtSim.addEventListener('input', () => updateSimulator(true));

        elements.runButton.addEventListener('click', () => {
            if (currentSimulationData.t) {
                //animateMotor(currentSimulationData);
                animateMotor(currentSimulationData, readParameters());
            }
        });

        elements.toggleAnimation.addEventListener('click', toggleVisibility);
        elements.toggleTfButton.addEventListener('click', toggleVisibility);
        elements.toggleAnalysis.addEventListener('click', toggleVisibility);

        if (elements.toggleStability) {
            elements.toggleStability.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                btn.classList.toggle('active');
                if (btn.classList.contains('active')) {
                    elements.stabilitySection.style.display = 'block';
                }
                else {
                    elements.stabilitySection.style.display = 'none';
                }
            });
        }

        if (elements.toggleRobust) {
            elements.toggleRobust.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                btn.classList.toggle('active');
                if (btn.classList.contains('active')) {
                    elements.robustSection.style.display = 'block';
                } else {
                    elements.robustSection.style.display = 'none';
                }
            });
        }

        elements.modalButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal');
                document.getElementById(modalId).style.display = 'block';
            });
        });

        elements.closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal');
                document.getElementById(modalId).style.display = 'none';
            });
        });

        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        });
    }

    function calculateTransientMetrics(time, output, setpoint) {
        if (!output || output.length === 0 || setpoint === 0) {
            return { tr: 0, ts: 0, os: 0, ess: 0 };
        }

        const finalValue = output[output.length - 1];    
        const ess = setpoint - finalValue;
        let peak = 0;
        
        if (setpoint > 0) {
            peak = Math.max(...output);
        }
        else {
            peak = Math.min(...output);
        }

        let os = 0;
        if (Math.abs(peak) > Math.abs(finalValue)) {
            os = Math.abs((peak - finalValue) / finalValue) * 100;
        }

        let t10 = null, t90 = null;
        const target10 = finalValue * 0.1;
        const target90 = finalValue * 0.9;

        for (let i = 0; i < output.length; i++) {
            const val = output[i];
            if (setpoint > 0) {
                if (t10 === null && val >= target10) t10 = time[i];
                if (t90 === null && val >= target90) t90 = time[i];
            } 
            else {
                if (t10 === null && val <= target10) t10 = time[i];
                if (t90 === null && val <= target90) t90 = time[i];
            }
        }
        const tr = (t10 !== null && t90 !== null) ? Math.abs(t90 - t10) : 0;

        const tolerance = 0.02; 
        const upperBand = finalValue * (1 + tolerance);
        const lowerBand = finalValue * (1 - tolerance);
        let ts = 0;

        for (let i = time.length - 1; i >= 0; i--) {
            const val = output[i];
            if (setpoint > 0) {
                if (val > upperBand || val < lowerBand) {
                    ts = time[i];
                    break; 
                }
            }
            else {
                if (Math.abs(val - finalValue) > Math.abs(finalValue * tolerance)) {
                    ts = time[i];
                    break;
                }
            }
        }

        return { tr, ts, os, ess };
    }

    function updateStability(params) {
        if (!elements.valPoles) return;

        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, plantType, isPIDEnabled } = params;

        if (elements.toggleStability) {
            const modeText = isPIDEnabled ? "(Closed Loop)" : "(Open Loop)";
            elements.toggleStability.textContent = `Analisis Kestabilan ${modeText}`;
        }

        const p_s2 = La * J;
        const p_s1 = Ra * J + La * b;
        const p_s0 = Ra * b + Kt * Kb;
        
        let coeffs = [];

        if (isPIDEnabled) {
            if (plantType === '1') {
                coeffs = [
                    p_s2,
                    p_s1 + (Kt * Kf * Kd),
                    p_s0 + (Kt * Kf * Kp),
                    Kt * Kf * Ki
                ];
            }
            else {
                coeffs = [
                    p_s2,
                    p_s1,
                    p_s0 + (Kt * Kf * Kd),
                    Kt * Kf * Kp,
                    Kt * Kf * Ki
                ];
            }
        }
        else {
            if (plantType === '1') {
                coeffs = [p_s2, p_s1, p_s0];
            }
            else {
                coeffs = [p_s2, p_s1, p_s0, 0];
            }
        }

        const roots = findRoots(coeffs);

        roots.sort((a, b) => C.mag(b) - C.mag(a));

        let polesHtml = '';
        let isUnstable = false;
        let isMarginal = false;

        roots.forEach((root, index) => {
            const re = root.re;
            const im = root.im;
            
            if (re > 1e-5) isUnstable = true;          
            else if (Math.abs(re) <= 1e-5) isMarginal = true; 

            let valStr = '';
            const reStr = Math.abs(re) < 1e-5 ? '0' : re.toFixed(4);
            const imAbsStr = Math.abs(im).toFixed(4);

            if (Math.abs(im) < 1e-5) {
                valStr = `<span style="color: var(--color-info);">${reStr}</span>`;
            }
            else {
                const sign = im >= 0 ? '+' : '-';
                valStr = `<span style="color: var(--color-info);">${reStr}</span> <span style="color: rgb(255, 165, 0); margin-left:2px;"> ${sign} j${imAbsStr}</span>`;
            }

            polesHtml += `
                <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; display: flex; justify-content: space-between;">
                    <span style="color: var(--color-text-dim);"><strong>s<sub>${index+1}</sub></strong> = </span>
                    <span style="font-family: var(--font-mono);">${valStr}</span>
                </div>`;
        });

        elements.valPoles.innerHTML = polesHtml;

        if (isUnstable) {
            elements.valStatusCl.textContent = "TIDAK STABIL";
            elements.valStatusCl.style.color = "rgb(255, 77, 77)";
        }
        else if (isMarginal) {
            elements.valStatusCl.textContent = "MARGINAL / KRITIS";
            elements.valStatusCl.style.color = "rgb(255, 200, 0)";
        }
        else {
            elements.valStatusCl.textContent = "STABIL";
            elements.valStatusCl.style.color = "rgb(0, 255, 128)";
        }
    }

    function calculateBodeData(params) {
        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, plantType, isPIDEnabled } = params;
        
        const p2 = La * J;
        const p1 = La * b + Ra * J;
        const p0 = Ra * b + Kt * Kb;
        const pNum = Kt;

        const freqs = [];
        const numPoints = 150; // Resolusi dinaikkan sedikit untuk plot yang lebih halus
        const startExp = -1;
        const endExp = 3;
        
        for (let i = 0; i <= numPoints; i++) {
            const val = Math.pow(10, startExp + (endExp - startExp) * (i / numPoints));
            freqs.push(val);
        }

        const mags = [];
        const phases = [];
        
        freqs.forEach(w => {
            const s = { re: 0, im: w };
            const s2 = { re: -w * w, im: 0 }; // Hasil dari C.mul(s,s)
            
            const term2 = { re: p2 * s2.re, im: 0 };
            const term1 = { re: 0, im: p1 * w };
            const term0 = { re: p0, im: 0 };
            
            let den = C.add(C.add(term2, term1), term0);
            
            // PERBAIKAN MATEMATIS: plantType === '2' (Kendali Posisi), bukan '0'
            if (plantType === '2') {
                den = C.mul(den, s); 
            }
            
            const PlantVal = C.div({ re: pNum, im: 0 }, den);

            let ControllerVal = { re: 1, im: 0 };
            
            if (isPIDEnabled) {
                const Pterm = { re: Kp, im: 0 };
                // PERBAIKAN MATEMATIS: D-term murni s*Kd = j*w*Kd
                const Dterm = { re: 0, im: Kd * w };
                const Iterm = { re: 0, im: -Ki / w };
                
                ControllerVal = C.add(C.add(Pterm, Dterm), Iterm);
                
                const HVal = { re: Kf, im: 0 };
                ControllerVal = C.mul(ControllerVal, HVal);
            }

            const LoopGain = C.mul(PlantVal, ControllerVal);
            
            const magAbs = C.mag(LoopGain);
            const magdB = 20 * Math.log10(magAbs);
            
            let phaseRad = Math.atan2(LoopGain.im, LoopGain.re);
            let phaseDeg = phaseRad * (180 / Math.PI);
            
            mags.push(magdB);
            phases.push(phaseDeg);
        });

        let pm = null;
        let gm = null;
        let pmFreq = null;
        let gmFreq = null;

        for (let i = 0; i < freqs.length - 1; i++) {
            if ((mags[i] > 0 && mags[i+1] <= 0) || (mags[i] < 0 && mags[i+1] >= 0)) {
                const slope = (phases[i+1] - phases[i]) / (mags[i+1] - mags[i]);
                const phaseAt0dB = phases[i] + slope * (0 - mags[i]);
                
                let pNorm = phaseAt0dB;
                while (pNorm > 0) pNorm -= 360;
                while (pNorm < -360) pNorm += 360;
                
                pm = 180 + pNorm;
                pmFreq = freqs[i];
            }
            
            const p1 = phases[i];
            const p2 = phases[i+1];
            
             if ((p1 > -180 && p2 <= -180) || (p1 < -180 && p2 >= -180)) {
                const slope = (mags[i+1] - mags[i]) / (phases[i+1] - phases[i]);
                const magAt180 = mags[i] + slope * (-180 - phases[i]);
                gm = -magAt180;
                gmFreq = freqs[i];
             }
        }

        return { freqs, mags, phases, pm, gm, pmFreq, gmFreq };
    }

    function plotFrequencyAnalysis(params, bodeData) {
        const { freqs, mags, phases, pm, gm } = bodeData;
        const { isPIDEnabled } = params;

        const colorText = '#d4d4d4';
        const colorGrid = '#4a4a4a';
        const colorMag = '#00c7ff';
        const colorPhase = '#ff9f43';
        const colorRef = 'rgba(255,255,255,0.3)';
        const colorPole = '#ff4d4d';
        
        const traceMag = {
            x: freqs,
            y: mags,
            name: 'Magnitudo (dB)',
            type: 'scatter',
            mode: 'lines',
            line: { color: colorMag, width: 2 },
            xaxis: 'x', // Shared X-Axis
            yaxis: 'y',
            showlegend: true
        };

        const tracePhase = {
            x: freqs,
            y: phases,
            name: 'Fasa (deg)',
            type: 'scatter',
            mode: 'lines',
            line: { color: colorPhase, width: 2 },
            xaxis: 'x', // Shared X-Axis
            yaxis: 'y2',
            showlegend: true
        };
        
        const line0dB = {
            x: freqs, y: Array(freqs.length).fill(0),
            mode: 'lines', name: 'Ref 0 dB',
            line: { color: colorRef, dash: 'dot', width: 1 },
            xaxis: 'x', yaxis: 'y',
            showlegend: false
        };

        const line180Deg = {
            x: freqs, y: Array(freqs.length).fill(-180),
            mode: 'lines', name: 'Ref -180°',
            line: { color: colorRef, dash: 'dot', width: 1 },
            xaxis: 'x', yaxis: 'y2',
            showlegend: false
        };

        const layoutBode = {
            title: 'Bode Plot (Respon Frekuensi)',
            titlefont: { color: colorText, family: 'Segoe UI' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: colorText, family: 'Segoe UI' },
            showlegend: true,
            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: 1.1 },
            hovermode: 'x unified', // Menggabungkan tooltip untuk pembacaan titik potong yang mudah
            hoverlabel: { 
                bgcolor: '#222222', 
                font: { color: '#ffffff' }, // Perbaikan warna teks hover (kontras)
                bordercolor: 'rgba(255,255,255,0.2)' 
            },
            
            xaxis: { 
                type: 'log', 
                title: 'Frekuensi (rad/s)', 
                gridcolor: colorGrid, 
                range: [-1, 3] 
            },
            yaxis: { 
                title: 'Magnitude (dB)', 
                titlefont: { color: colorMag },
                tickfont: { color: colorMag },
                gridcolor: colorGrid,
                // Hilangkan domain, biarkan menggunakan full tinggi grafik
            },
            yaxis2: { 
                title: 'Phase (deg)', 
                titlefont: { color: colorPhase },
                tickfont: { color: colorPhase },
                overlaying: 'y', // INI KUNCI AGAR GRAFIK BERTUMPUK (OVERLAY)
                side: 'right',   // Sumbu Y fasa dipindah ke kanan
                showgrid: false, // Matikan grid agar tidak menabrak grid magnitude
                range: [-270, 90]
            },
            margin: { t: 60, b: 40, l: 60, r: 60 } // Margin kanan diperbesar untuk sumbu ganda
        };
        
        Plotly.newPlot(elements.plotBodeContainer, [traceMag, line0dB, tracePhase, line180Deg], layoutBode, { responsive: true, displayModeBar: true });

        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, plantType } = params;
        const p_s2 = La * J;
        const p_s1 = Ra * J + La * b;
        const p_s0 = Ra * b + Kt * Kb;
        let coeffs = [];
        
        if (isPIDEnabled) {
            if (plantType === '1') {
                coeffs = [p_s2, p_s1 + (Kt*Kf*Kd), p_s0 + (Kt*Kf*Kp), Kt*Kf*Ki];
            } else {
                coeffs = [p_s2, p_s1, p_s0 + (Kt*Kf*Kd), Kt*Kf*Kp, Kt*Kf*Ki];
            }
        } else {
            coeffs = (plantType === '1') ? [p_s2, p_s1, p_s0] : [p_s2, p_s1, p_s0, 0];
        }
        
        const poles = findRoots(coeffs);
        const poleRe = poles.map(p => p.re);
        const poleIm = poles.map(p => p.im);

        const tracePoles = {
            x: poleRe,
            y: poleIm,
            mode: 'markers',
            type: 'scatter',
            name: isPIDEnabled ? 'Closed-Loop Poles' : 'Open-Loop Poles',
            marker: { symbol: 'x', size: 12, color: colorPole, line: { width: 2 } },
            showlegend: true
        };

        const maxRe = Math.max(...poleRe.map(Math.abs), 5) * 1.2;
        const maxIm = Math.max(...poleIm.map(Math.abs), 5) * 1.2;
        const limit = Math.max(maxRe, maxIm);

        const layoutSPlane = {
            title: 'Peta Pole-Zero (Bidang S)',
            titlefont: { color: colorText, family: 'Segoe UI' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: colorText, family: 'Segoe UI' },
            xaxis: { title: 'Real (σ)', gridcolor: colorGrid, zerolinecolor: '#fff', range: [-limit, limit/4] },
            yaxis: { title: 'Imaginary (jω)', gridcolor: colorGrid, zerolinecolor: '#fff', range: [-limit, limit] },
            showlegend: true,
            legend: { x: 0, y: 1 },
            margin: { t: 40, b: 40, l: 40, r: 40 }
        };

        Plotly.newPlot(elements.plotStabilityContainer, [tracePoles], layoutSPlane, { responsive: true, displayModeBar: true });

        // (Sisa logika tabel Robustness tetap sama seperti kode Anda sebelumnya)
        let robustHTML = '';

        if (isPIDEnabled) {
            robustHTML = `
                <table style="width:100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Status Sistem:</strong></td>
                        <td style="padding: 5px; font-weight: bold; color: var(--color-primary);">Closed Loop (PID)</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Phase Margin (PM):</strong></td>
                        <td style="padding: 5px; font-weight: bold; color: ${pm > 45 ? 'var(--color-secondary)' : 'var(--color-danger)'};">
                            ${pm !== null ? pm.toFixed(2) + '°' : 'N/A'}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Gain Margin (GM):</strong></td>
                        <td style="padding: 5px; font-weight: bold; color: ${gm > 6 || gm === null ? 'var(--color-secondary)' : 'var(--color-warn)'};">
                            ${gm !== null ? gm.toFixed(2) + ' dB' : '> Inf'}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Robustness:</strong></td>
                        <td style="padding: 5px;">
                            ${ pm > 45 ? '<span style="color:#0f0">Good</span>' : '<span style="color:#f00">Poor (Osilatif)</span>' }
                        </td>
                    </tr>
                </table>
                <p style="font-size:0.85rem; margin-top:10px; color:var(--color-text-dim); border-top:1px solid #444; padding-top:5px;">
                    <em>Sistem aktif mengoreksi error. PM > 45° disarankan agar tahan terhadap perubahan beban (${params.TL.toFixed(3)} Nm).</em>
                </p>
            `;
        } else {
            robustHTML = `
                <table style="width:100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Status Sistem:</strong></td>
                        <td style="padding: 5px; font-weight: bold; color: var(--color-warn);">Open Loop (Manual)</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Phase Margin (PM):</strong></td>
                        <td style="padding: 5px; font-family: var(--font-mono); color: var(--color-text-dim);">N/A</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Gain Margin (GM):</strong></td>
                        <td style="padding: 5px; font-family: var(--font-mono); color: var(--color-text-dim);">N/A</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; color: var(--color-text-dim);"><strong>Robustness:</strong></td>
                        <td style="padding: 5px; color: var(--color-danger);">Low (Tidak ada feedback)</td>
                    </tr>
                </table>
                <p style="font-size:0.85rem; margin-top:10px; color:var(--color-text-dim); border-top:1px solid #444; padding-top:5px;">
                    <em>Pada mode Open Loop, analisis Robustness tidak berlaku karena sistem tidak melakukan koreksi otomatis terhadap gangguan.</em>
                </p>
            `;
        }

        if(elements.robustSection) {
            elements.robustSection.innerHTML = robustHTML;
        }
    }

    function updateSimulator(runSimulation) {
        const params = readParameters();
        
        if (runSimulation) {
            currentSimulationData = simulateSystem(params);
            plotResponse(currentSimulationData, params);
            updateAnalysis(currentSimulationData, params);
            
            try {
                if (typeof updateStability === 'function') { 
                    updateStability(params); 
                }
                
                const bodeData = calculateBodeData(params);
                plotFrequencyAnalysis(params, bodeData);
                
            } catch (e) {
                console.warn("Analisis Frekuensi dilewati karena parameter ekstrem atau error kalkulasi:", e);
            }
        }
        
        updateDerivedParameters();
        updateTransferFunction();
    }

    function readParameters() {
        return {
            Ra: parseFloat(elements.Ra.value),
            La: parseFloat(elements.La.value),
            
            J: Math.max(parseFloat(elements.J.value), 1e-9), 
            b: parseFloat(elements.b.value),
            
            Kt: parseFloat(elements.Kt.value),
            Kb: parseFloat(elements.Kb.value),
            
            TL: parseFloat(elements.TL.value),

            Kp: parseFloat(elements.Kp.value),
            Ki: parseFloat(elements.Ki.value),
            Kd: parseFloat(elements.Kd.value),
            
            plantType: elements.plantType.value,
            setpoint: parseFloat(elements.setpoint.value),
            
            Kf: parseFloat(elements.Kf.value),

            Cth: parseFloat(elements.Cth ? elements.Cth.value : 5.0),
            hA: parseFloat(elements.hA ? elements.hA.value : 1.0),
            
            Vmax: Math.abs(parseFloat(elements.Vmax.value)),
            
            tSim: Math.max(0.001, parseFloat(elements.tSim.value)),
            dt: Math.max(0.0001, parseFloat(elements.dtSim.value) / 1000),
            
            isPIDEnabled: elements.pidEnable.checked
        };
    }

    function simulateSystem(params) {
        const { Ra, La, Kt, Kb, J, b, TL, Kp, Ki, Kd, Kf, Vmax, setpoint, plantType, tSim, dt, isPIDEnabled, Cth, hA } = params;

        const tau_e = La / Math.max(Ra, 1e-9); 
        const tau_m = J / Math.max(b, 1e-9);
        const tau_min = Math.min(tau_e, tau_m);

        let dt_physics = Math.max(1e-7, Math.min(tau_min * 0.1, dt));
        if (dt_physics < dt / 1000) dt_physics = dt / 1000;

        const nSamples = Math.floor(tSim / dt);
        const t = new Array(nSamples).fill(0);
        const y = new Array(nSamples).fill(0);
        const u_clamped = new Array(nSamples).fill(0);
        const u_unclamped = new Array(nSamples).fill(0);
        const r = new Array(nSamples).fill(setpoint);
        
        // Array Termal untuk Plotting/Animasi
        const T_array = new Array(nSamples).fill(0);
        const Ra_array = new Array(nSamples).fill(0);
        const Kt_array = new Array(nSamples).fill(0);

        let x1 = 0; // Posisi (Theta)
        let x2 = 0; // Kecepatan (Omega)
        let x3 = 0; // Arus (i)

        let integralTerm = 0;
        let prevPV = 0;
        let derivativeFilterState = 0;
        
        const tauD = 0.001;
        const alpha = dt / (tauD + dt); 
        
        // Konstanta Suhu
        const Tamb = 25.0;
        let T_current = Tamb; 
        const alphaCu = 0.00393;
        const alphaMag = 0.002;

        // Modifikasi derivativeFunc agar menerima parameter yang berubah (Dinamika Suhu)
        const derivativeFunc = (currX, V, load, R_dyn, Kt_dyn, Kb_dyn) => {
            const dx1 = currX[1];
            const torqueElectrical = Kt_dyn * currX[2];
            const torqueFriction = b * currX[1];
            const torqueLoad = (currX[1] > 0 ? load : (currX[1] < 0 ? -load : 0)); 
            const dx2 = (torqueElectrical - torqueFriction - torqueLoad) / J;
            const backEMF = Kb_dyn * currX[1];
            const dx3 = (V - R_dyn * currX[2] - backEMF) / Math.max(La, 1e-12); 
            return [dx1, dx2, dx3];
        };

        for (let i = 0; i < nSamples; i++) {
            const currentTime = i * dt;
            t[i] = currentTime;
            y[i] = (plantType === '1') ? x2 : x1;

            // --- 1. EVALUASI DINAMIKA TERMAL (EULER INTEGRATION) ---
            const Ra_dyn = Ra * (1 + alphaCu * (T_current - Tamb));
            const Kt_dyn = Kt * (1 - alphaMag * (T_current - Tamb));
            const Kb_dyn = Kb * (1 - alphaMag * (T_current - Tamb));

            const Ploss = x3 * x3 * Ra_dyn; // Joule Heating
            const Pcool = hA * (T_current - Tamb); // Dissipation
            
            T_current += ((Ploss - Pcool) / Math.max(Cth, 0.01)) * dt;
            
            T_array[i] = T_current;
            Ra_array[i] = Ra_dyn;
            Kt_array[i] = Kt_dyn;

            // --- 2. EVALUASI KENDALI PID ---
            let appliedVoltage = 0;
            let rawVoltage = 0;
            const pv = y[i];

            if (isPIDEnabled) {
                const feedback = pv * Kf; 
                const error = setpoint - feedback;
                
                const proportionalTerm = Kp * error;

                // Perbaikan D-Term: Evaluasi perubahan PV
                const rawDerivative = - (pv - prevPV) / dt; 
                derivativeFilterState = alpha * rawDerivative + (1 - alpha) * derivativeFilterState;
                
                // KUNCI PERBAIKAN: Limiter Slew-Rate dihapus total.
                // Filter alfa (low-pass) sudah cukup menahan noise matematika.
                const derivativeTerm = Kd * derivativeFilterState;

                rawVoltage = proportionalTerm + integralTerm + derivativeTerm;
                
                // Clamping (Saturasi) Aktuator
                if (rawVoltage > Vmax) appliedVoltage = Vmax;
                else if (rawVoltage < -Vmax) appliedVoltage = -Vmax;
                else appliedVoltage = rawVoltage;

                const isSaturated = (Math.abs(rawVoltage) > Vmax);
                const isHelping = (rawVoltage * error < 0);

                // Anti-Windup
                if (!isSaturated || isHelping) {
                    integralTerm += Ki * error * dt;
                }

                prevPV = pv;
            } else {
                rawVoltage = setpoint;
                if (rawVoltage > Vmax) appliedVoltage = Vmax;
                else if (rawVoltage < -Vmax) appliedVoltage = -Vmax;
                else appliedVoltage = rawVoltage;
            }

            u_clamped[i] = appliedVoltage;
            u_unclamped[i] = rawVoltage;

            // --- 3. EVALUASI FISIKA MOTOR (RK4) ---
            let timeAccumulator = 0;
            while (timeAccumulator < dt) {
                let step = dt_physics;
                if (timeAccumulator + step > dt) step = dt - timeAccumulator;

                const Xn = [x1, x2, x3]; 
                
                // Operkan parameter termal yang terdegradasi ke mesin RK4
                const k1 = derivativeFunc(Xn, appliedVoltage, TL, Ra_dyn, Kt_dyn, Kb_dyn); 
                const k2_state = [Xn[0] + 0.5 * k1[0] * step, Xn[1] + 0.5 * k1[1] * step, Xn[2] + 0.5 * k1[2] * step];
                
                const k2 = derivativeFunc(k2_state, appliedVoltage, TL, Ra_dyn, Kt_dyn, Kb_dyn);
                const k3_state = [Xn[0] + 0.5 * k2[0] * step, Xn[1] + 0.5 * k2[1] * step, Xn[2] + 0.5 * k2[2] * step];
                
                const k3 = derivativeFunc(k3_state, appliedVoltage, TL, Ra_dyn, Kt_dyn, Kb_dyn);
                const k4_state = [Xn[0] + k3[0] * step, Xn[1] + k3[1] * step, Xn[2] + k3[2] * step];
                
                const k4 = derivativeFunc(k4_state, appliedVoltage, TL, Ra_dyn, Kt_dyn, Kb_dyn);

                x1 += (1/6) * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]) * step;
                x2 += (1/6) * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]) * step;
                x3 += (1/6) * (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]) * step;

                timeAccumulator += step;
            }
        }

        return { t, y, u_unclamped, u_clamped, r, T_array, Ra_array, Kt_array }; 
    }

    function plotResponse(data, params) {
        const { t, y, u_unclamped, u_clamped } = data;
        const { setpoint, plantType, Vmax, isPIDEnabled } = params;

        const yAxisTitle = plantType === '1' ? 'Kecepatan (rad/s)' : 'Posisi (rad)';
        
        const setpointTrace = {
            x: t,
            y: Array(t.length).fill(setpoint),
            mode: 'lines',
            name: 'Setpoint',
            line: { color: colorDanger, dash: 'dash' }
        };

        const responseTrace = {
            x: t,
            y: y,
            mode: 'lines',
            name: 'Respons Sistem (Y)',
            line: { color: colorPrimary, width: 3 }
        };

        const tracesToPlot = [responseTrace];
        if (isPIDEnabled) {
            tracesToPlot.unshift(setpointTrace);
        }

        const plotlyLayoutResponse = {
            title: isPIDEnabled ? 'Respons Sistem Closed-Loop' : 'Respons Sistem Open-Loop',
            titlefont: { color: colorPrimary, family: fontMain },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: colorText, family: fontMain },
            xaxis: { title: 'Waktu (detik)', gridcolor: colorGrid },
            yaxis: { title: yAxisTitle, gridcolor: colorGrid, zerolinecolor: colorPrimary },
            legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' }
        };

        const controlSignalTrace = {
            x: t,
            y: u_clamped,
            mode: 'lines',
            name: 'Sinyal Kendali (U)',
            line: { color: colorWarn, width: 2 },
        };
        const controlSignalUnclampedTrace = {
            x: t,
            y: u_unclamped,
            mode: 'lines',
            name: 'Sinyal Kendali (Ideal)',
            line: { color: colorSecondary, width: 2, dash: 'dot' },
            visible: 'legendonly'
        };
        const VmaxTrace = {
            x: t,
            y: Array(t.length).fill(Vmax),
            mode: 'lines',
            name: 'Vmax',
            line: { color: colorDanger, dash: 'dashdot' },
            visible: 'legendonly'
        };
        
        const controlTraces = [controlSignalTrace, controlSignalUnclampedTrace, VmaxTrace];

        const plotlyLayoutControl = {
            title: 'Sinyal Kendali (Tegangan)',
            titlefont: { color: colorWarn, family: fontMain },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: colorText, family: fontMain },
            xaxis: { title: 'Waktu (detik)', gridcolor: colorGrid },
            yaxis: { title: 'Tegangan (V)', gridcolor: colorGrid, zerolinecolor: colorWarn, range: [-Vmax * 1.5, Vmax * 1.5] },
            legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' }
        };

        Plotly.newPlot(elements.plotContainer, tracesToPlot, plotlyLayoutResponse, { responsive: true });
        Plotly.newPlot(elements.plotControlContainer, controlTraces, plotlyLayoutControl, { responsive: true });
    }

    function updateDerivedParameters() {
        const p = readParameters();
        const den_s2 = p.La * p.J;
        const den_s1 = p.Ra * p.J + p.La * p.b;
        const den_s0 = p.Ra * p.b + p.Kt * p.Kb;

        if (den_s0 === 0 || den_s2 === 0) {
            elements.derivedK.textContent = 'N/A';
            elements.derivedOmega.textContent = 'N/A';
            elements.derivedZeta.textContent = 'N/A';
            return;
        }
        const K = p.Kt / den_s0;
        const omega_n = Math.sqrt(den_s0 / den_s2);
        const zeta = (den_s1 / den_s2) / (2 * omega_n);

        elements.derivedK.textContent = K.toPrecision(3);
        elements.derivedOmega.textContent = omega_n.toPrecision(3);
        elements.derivedZeta.textContent = zeta.toPrecision(3);
    }

    function formatScientific(num) {
        if (Math.abs(num) < 1e-15) return "0";
        if (Math.abs(num) >= 0.001 && Math.abs(num) < 1000) {
            return parseFloat(num.toPrecision(3)).toString();
        }
        let [mantissa, exponent] = num.toExponential(2).split('e');
        exponent = exponent.replace('+', '');
        return `${mantissa} \\times 10^{${exponent}}`;
    }

    function tfPoly(...terms) {
        let s = '';
        for (let i = 0; i < terms.length; i++) {
            const [val, power] = terms[i];
            if (Math.abs(val) < 1e-15) continue;
            
            let sign = (val > 0) ? ' + ' : ' - ';
            if (s === '' && val > 0) sign = '';
            if (s === '' && val < 0) sign = '-';
            
            let numStr = formatScientific(Math.abs(val));
            
            let term = '';
            if (power) {
                if (numStr === "1") term = power;
                else term = `${numStr} ${power}`;
            } else {
                term = numStr;
            }
            
            s += `${sign}${term}`;
        }
        return s || '0';
    }

    function updateTransferFunction() {
        const p = readParameters();
        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, isPIDEnabled, plantType, setpoint, TL } = p;

        const plant_s2 = La * J;
        const plant_s1 = Ra * J + La * b;
        const plant_s0 = Ra * b + Kt * Kb;
        const plant_num = Kt;

        let htmlContent = '';

        const valR = setpoint.toFixed(2);
        const valTL = TL.toFixed(4);

        if (isPIDEnabled) {
            const C_num_s2 = Kd;
            const C_num_s1 = Kp;
            const C_num_s0 = Ki;
            const H = Kf;
            
            const numStrRef = tfPoly(
                [C_num_s2 * plant_num, 's^2'],
                [C_num_s1 * plant_num, 's'],
                [C_num_s0 * plant_num, '']
            );
            
            const numStrDist = tfPoly(
                [-La, 's^2'],
                [-Ra, 's']
            );
            
            let denStr = '';
            if (plantType === '1') {
                denStr = tfPoly(
                    [plant_s2, 's^3'],
                    [plant_s1 + (C_num_s2 * plant_num * H), 's^2'],
                    [plant_s0 + (C_num_s1 * plant_num * H), 's'],
                    [C_num_s0 * plant_num * H, '']
                );
            } else {
                denStr = tfPoly(
                    [plant_s2, 's^4'],
                    [plant_s1, 's^3'],
                    [plant_s0 + (C_num_s2 * plant_num * H), 's^2'],
                    [C_num_s1 * plant_num * H, 's'],
                    [C_num_s0 * plant_num * H, '']
                );
            }

            htmlContent += `
                <div style="margin-bottom: 20px; border-bottom: 1px dashed #444; padding-bottom: 15px;">
                    <p style="color: var(--color-warn); margin-bottom: 5px;"><strong>1. Fungsi Alih Tracking (Respon terhadap Setpoint):</strong></p>
                    $$ \\frac{Y(s)}{R(s)} = \\frac{${numStrRef}}{${denStr}} $$
                </div>
            `;

            htmlContent += `
                <div style="margin-bottom: 20px; border-bottom: 1px dashed #444; padding-bottom: 15px;">
                    <p style="color: var(--color-warn); margin-bottom: 5px;"><strong>2. Persamaan Respon Gangguan (Efek $T_L$):</strong></p>
                    $$ Y_{dist}(s) = \\left[ \\frac{${numStrDist}}{${denStr}} \\right] \\times (${valTL}) $$
                </div>
            `;

            htmlContent += `
                <div>
                    <p style="color: var(--color-text); margin-bottom: 5px;"><strong>3. Persamaan Respon Total Output:</strong></p>
                    $$ Y_{total}(s) = \\underbrace{ \\left[ \\frac{Y}{R} \\right] (${valR}) }_{\\text{Tracking}} + \\underbrace{ \\left[ \\frac{Y}{T_L} \\right] (${valTL}) }_{\\text{Disturbance}} $$
                </div>
            `;
            
            elements.toggleTfButton.textContent = 'Model Matematis Sistem (Closed Loop)';

        } else {
            const title = 'Fungsi Alih Sistem <strong>Open-Loop</strong> (Plant):';
            elements.toggleTfButton.textContent = 'Fungsi Alih Sistem (Open Loop)';

            const numStr = formatScientific(plant_num);
            const denStr = tfPoly(
                [plant_s2, 's^2'],
                [plant_s1, 's'],
                [plant_s0, '']
            );

            if (plantType === '1') {
                htmlContent = `<p>${title}</p>$$ G_\\omega(s) = \\frac{${numStr}}{${denStr}} $$`;
            } else {
                htmlContent = `<p>${title}</p>$$ G_\\theta(s) = \\frac{${numStr}}{s(${denStr})} $$`;
            }
        }
        
        elements.tfContainer.innerHTML = htmlContent;
        MathJax.typesetPromise([elements.tfContainer]);
    }

    function updateAnalysis(data, params) {
        const { y, u_clamped } = data;
        const { setpoint, plantType, isPIDEnabled, Vmax } = params;
        
        if (!y || y.length === 0) {
            elements.analysisContainer.innerHTML = "<p>Geser slider untuk memulai simulasi.</p>";
            return;
        }

        let analysisHTML = "<ul>";
        const lastVal = y[y.length - 1];

        const metrics = calculateTransientMetrics(data.t, data.y, params.setpoint);

        if (elements.valTr) elements.valTr.textContent = metrics.tr.toFixed(3) + ' s';
        if (elements.valTs) elements.valTs.textContent = metrics.ts.toFixed(3) + ' s';
        if (elements.valOs) elements.valOs.textContent = metrics.os.toFixed(2) + ' %';
        if (elements.valEss) elements.valEss.textContent = '-';

        if (isPIDEnabled) {
            const error_ss = metrics.ess.toFixed(4);
            const overshoot = metrics.os.toFixed(2);
            if (elements.valEss) elements.valEss.textContent = metrics.ess.toFixed(4);

            if (Math.abs(lastVal) > Math.abs(setpoint) * 100 || isNaN(lastVal)) {
                analysisHTML += `<li style="color: ${colorDanger}"><strong>Sistem Tidak Stabil!</strong> Respons divergen terdeteksi. Periksa parameter PID Anda.</li>`;
            }
            else {
                if (Math.abs(error_ss / setpoint) > 0.01) {
                    analysisHTML += `<li>Terdeteksi <strong>Error Steady-State</strong> sebesar <strong>${error_ss}</strong>.`;
                    if (params.Ki === 0) {
                        analysisHTML += ` Ini wajar untuk kontroler P atau PD-only. <i>Saran: Aktifkan komponen Integral ($K_i$).</i></li>`;
                    }
                    else {
                        analysisHTML += ` <i>Error masih ada. Ini bisa jadi karena Integral Windup atau $K_i$ terlalu kecil.</i></li>`;
                    }
                }
                else {
                    analysisHTML += `<li><strong>Error Steady-State Minimal.</strong> Sistem berhasil mencapai setpoint.</li>`;
                }

                if (overshoot > 20) {
                    analysisHTML += `<li style="color: ${colorWarn}"><strong>Overshoot Signifikan</strong> (<strong>${overshoot}%</strong>) terdeteksi. Sistem terlalu 'agresif'.`;
                    analysisHTML += ` <i>Saran: Kurangi $K_p$ atau perbesar $K_d$.</i></li>`;
                }
                else if (overshoot > 1) {
                    analysisHTML += `<li><strong>Overshoot Wajar</strong> (<strong>${overshoot}%</strong>) terdeteksi.</li>`;
                }
                else {
                    analysisHTML += `<li><strong>Tidak ada Overshoot.</strong> Sistem <i>critically damped</i> atau <i>overdamped</i>.</li>`;
                }
            }
        }
        else {
            analysisHTML += `<li>Mode <strong>Open-Loop</strong> aktif. Sistem diberikan tegangan masukan konstan <strong>${setpoint} V</strong> (setelah dibatasi $V_{max}$).</li>`;
            if (plantType === '1') {
                analysisHTML += `<li>Kecepatan final sistem stabil di <strong>${lastVal.toPrecision(3)} rad/s</strong>.</li>`;
            }
            else {
                analysisHTML += `<li>Posisi sistem terus meningkat (integral dari kecepatan) dan mencapai <strong>${lastVal.toPrecision(3)} rad</strong> di akhir simulasi.</li>`;
            }
        }

        const isSaturated = u_clamped.some((u) => Math.abs(u) >= Vmax);
        if (isSaturated) {
            analysisHTML += `<li><strong>Saturasi Aktuator Terdeteksi.</strong> Sinyal kendali (tegangan) mencapai batas <strong>${Vmax} V</strong>. Ini membatasi kecepatan respons sistem.</li>`;
        }

        analysisHTML += "</ul>";
        elements.analysisContainer.innerHTML = analysisHTML;
        MathJax.typesetPromise([elements.analysisContainer]);
    }

    // ==========================================
    // 3D DIGITAL TWIN ENGINE (Three.js)
    // ==========================================
    let threeScene, threeCamera, threeRenderer, orbitControls;
    let motorShaft, roboticArm, targetArm, speedIndicator, stator;
    let animationFrameId = null;
    let hudOverlay = null;

    function init3DEnvironment() {
        const container = elements.animationContainer;
        
        // Hapus elemen canvas 2D bawaan jika masih ada
        const oldCanvas = document.getElementById('motor-canvas');
        if (oldCanvas) oldCanvas.remove();

        // Setup HUD (Head-Up Display) Overlay berbasis HTML/CSS
        if (!hudOverlay) {
            container.style.position = 'relative'; // Agar HUD menempel relatif ke kontainer
            hudOverlay = document.createElement('div');
            hudOverlay.style.position = 'absolute';
            hudOverlay.style.top = '15px';
            hudOverlay.style.right = '20px';
            hudOverlay.style.textAlign = 'right';
            hudOverlay.style.pointerEvents = 'none'; // Agar mouse bisa menembus HUD ke 3D Canvas
            hudOverlay.style.zIndex = '10';
            hudOverlay.style.background = 'rgba(0, 0, 0, 0.4)';
            hudOverlay.style.padding = '10px 15px';
            hudOverlay.style.borderRadius = '8px';
            hudOverlay.style.border = '1px solid #444';
            container.appendChild(hudOverlay);
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        // 1. Inisialisasi Scene, Kamera & Renderer
        threeScene = new THREE.Scene();
        // Latar transparan untuk menyatu dengan background gradient CSS Anda
        threeScene.background = null; 

        threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        threeCamera.position.set(20, 15, 30); // Posisi awal kamera (Isometrik)

        threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        threeRenderer.setSize(width, height);
        container.appendChild(threeRenderer.domElement);

        // 2. Orbit Controls (Interaksi Pan, Zoom, Rotate)
        orbitControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.05;

        // 3. Pencahayaan (Phong) - Sederhana tapi Elegan
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        threeScene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 15);
        threeScene.add(dirLight);

        // 4. PEMODELAN PROSEDURAL MOTOR DC
        
        // A. Stator (Body Motor) & Base Mount
        const statorGeo = new THREE.CylinderGeometry(6, 6, 14, 32);
        const statorMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, shininess: 50 });
        stator = new THREE.Mesh(statorGeo, statorMat); // <-- Modifikasi: 'stator' kini mengakses variabel global
        stator.rotation.x = Math.PI / 2;
        threeScene.add(stator);

        const mountGeo = new THREE.BoxGeometry(10, 2, 10);
        const mountMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.set(0, -6.5, 0);
        threeScene.add(mount);

        // B. Poros Rotor (Shaft)
        const shaftGeo = new THREE.CylinderGeometry(1.2, 1.2, 22, 16);
        const shaftMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 80 });
        motorShaft = new THREE.Mesh(shaftGeo, shaftMat);
        motorShaft.rotation.x = Math.PI / 2;
        threeScene.add(motorShaft);

        // C. Indikator Putaran (Balok kecil di poros untuk Mode Kecepatan)
        const indGeo = new THREE.BoxGeometry(4, 4, 1.5);
        const indMat = new THREE.MeshPhongMaterial({ color: 0x00c7ff });
        speedIndicator = new THREE.Mesh(indGeo, indMat);
        speedIndicator.position.set(0, 10, 0); // Di ujung depan poros
        motorShaft.add(speedIndicator);

        // D. Lengan Robot (Untuk Mode Posisi)
        const armGeo = new THREE.BoxGeometry(1.5, 12, 1.5);
        armGeo.translate(0, 6, 0); // Geser pivot anchor point ke bagian bawah lengan
        const armMat = new THREE.MeshPhongMaterial({ color: 0x00aaff });
        roboticArm = new THREE.Mesh(armGeo, armMat);
        roboticArm.position.set(0, 0, 9); // Ditempelkan ke sumbu global Z=9 (ujung poros)
        threeScene.add(roboticArm);

        // E. Target Bayangan (Ghost Setpoint)
        const targetGeo = new THREE.BoxGeometry(1.5, 12, 1.5);
        targetGeo.translate(0, 6, 0);
        const targetMat = new THREE.MeshPhongMaterial({ 
            color: 0xff4d4d, 
            transparent: true, 
            opacity: 0.35 
        });
        targetArm = new THREE.Mesh(targetGeo, targetMat);
        targetArm.position.set(0, 0, 9);
        threeScene.add(targetArm);

        // Menangani Resize Window
        window.addEventListener('resize', () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            threeRenderer.setSize(newWidth, newHeight);
            threeCamera.aspect = newWidth / newHeight;
            threeCamera.updateProjectionMatrix();
        });
    }

    function animateMotor(data, params) {
        const { y, t } = data;
        // Tambahkan isPIDEnabled dari params
        const { plantType, setpoint, isPIDEnabled } = params; 
        
        // Inisialisasi Environment hanya jika belum dirender (Lazy Loading)
        if (!threeScene) {
            init3DEnvironment();
        }

        const isSpeedControl = (plantType === '1');

        // Toggle visibilitas objek berdasarkan mode kendali
        if (isSpeedControl) {
            speedIndicator.visible = true;
            roboticArm.visible = false;
            targetArm.visible = false;
        } else {
            speedIndicator.visible = false;
            roboticArm.visible = true;
            
            // Lengan bayangan (target) HANYA ditampilkan jika Closed-Loop (PID) aktif
            if (isPIDEnabled) {
                targetArm.visible = true;
                targetArm.rotation.z = setpoint; 
            } else {
                targetArm.visible = false; // Sembunyikan bayangan jika Open-Loop
            }
        }

        let frame = 0;

        function drawFrame() {
            if (frame >= t.length) {
                cancelAnimationFrame(animationFrameId);
                return;
            }

            let angle;
            if (isSpeedControl) {
                const dt_anim = t[1] - t[0];
                let integratedAngle = 0;
                for (let i=0; i<=frame; i++) {
                    integratedAngle += y[i] * dt_anim;
                }
                angle = integratedAngle;
            } else {
                angle = y[frame];
            }

            motorShaft.rotation.y = angle;
            if (!isSpeedControl) roboticArm.rotation.z = angle;

            // --- Logika Perubahan Warna Termal ---
            const currentT = data.T_array[frame];
            const maxT = 120.0; // Anggap 120 Celcius motor menyala merah kritis
            const normT = Math.max(0, Math.min(1, (currentT - 25) / (maxT - 25)));
            
            // Interpolasi warna dari Abu-abu (74,74,74) ke Merah Kritis (255, 34, 34)
            const red = Math.floor(74 + (255 - 74) * normT);
            const gb = Math.floor(74 + (34 - 74) * normT);
            stator.material.color.setRGB(red/255, gb/255, gb/255);

            orbitControls.update();
            threeRenderer.render(threeScene, threeCamera);

            const modeText = isSpeedControl ? 
                '<span style="color: var(--color-secondary);">SPEED MODE</span>' : 
                '<span style="color: var(--color-danger);">POSITION (SERVO) MODE</span>';
            const unit = isSpeedControl ? 'rad/s' : 'rad';
            const currentVal = y[frame].toFixed(3);
            const inputVal = setpoint.toFixed(2);
            const currentTime = t[frame].toFixed(3);

            let bottomTextHTML = isPIDEnabled ? `Target: ${inputVal} ${unit}` : `Tegangan Masukan: ${inputVal} V`;
            
            // Warna font penunjuk suhu dinamis
            const tColor = currentT > 80 ? 'var(--color-danger)' : (currentT > 50 ? 'var(--color-warn)' : 'var(--color-secondary)');

            hudOverlay.innerHTML = `
                <div style="font-family: var(--font-title); font-size: 1.1rem; font-weight: bold; margin-bottom: 5px;">
                    ${modeText} ${!isPIDEnabled ? '<span style="font-size: 0.8rem; color: #888;">(OPEN-LOOP)</span>' : ''}
                </div>
                <div style="font-size: 0.9rem; color: #aaa; margin-bottom: 10px; font-family: var(--font-mono);">t = ${currentTime} s</div>
                <div style="font-size: 2rem; font-family: var(--font-mono); font-weight: bold; color: #fff;">
                    ${currentVal} <span style="font-size: 1rem; color: #888; font-family: var(--font-main);">${unit}</span>
                </div>
                <div style="font-size: 1rem; color: #888; font-family: var(--font-main);">
                    ${bottomTextHTML}
                </div>
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.85rem; text-align: right;">
                    <div style="color: ${tColor}; font-weight: bold; font-family: var(--font-mono);">Suhu Aktual: ${currentT.toFixed(1)} °C</div>
                    <div style="color: #aaa; font-family: var(--font-mono);">R_a (Aktual): ${data.Ra_array[frame].toFixed(4)} Ω</div>
                    <div style="color: #aaa; font-family: var(--font-mono);">K_t (Aktual): ${data.Kt_array[frame].toFixed(5)} Nm/A</div>
                </div>
            `;

            frame++;
            animationFrameId = requestAnimationFrame(drawFrame);
        }

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        drawFrame();
    }

    function toggleVisibility(event) {
        const button = event.currentTarget;
        let targetElement;

        switch (button.id) {
            case 'toggle-animation':
                targetElement = elements.animationContainer;
                break;
            case 'toggle-tf':
                targetElement = elements.tfContainer;
                break;
            case 'toggle-analysis':
                targetElement = elements.analysisContainer;
                break;
        }

        button.classList.toggle('active');
        if (button.classList.contains('active')) {
            targetElement.style.display = 'block'; 
            if (button.id === 'toggle-animation') targetElement.style.display = 'flex';
        }
        else {
            targetElement.style.display = 'none';
        }
    }

    function initializeApp() {
        const allSliders = document.querySelectorAll('.slider');
        allSliders.forEach(slider => {
            const textBox = document.getElementById(`${slider.id}-value`); 
            if (textBox) {
                const precision = slider.step.split('.')[1]?.length || 0;
                textBox.value = parseFloat(slider.value).toFixed(precision);
            }
        });
        
        if (elements.pidEnable.checked) {
            elements.pidParameters.classList.remove('disabled');
        }
        else {
            elements.pidParameters.classList.add('disabled');
        }
        
        updateSetpointLabel();
        setupEventListeners();
        
        elements.tfContainer.style.display = 'none';
        elements.toggleTfButton.classList.remove('active');
        elements.analysisContainer.style.display = 'none';
        elements.toggleAnalysis.classList.remove('active');

        updateSimulator(true);
    }

    initializeApp();
});