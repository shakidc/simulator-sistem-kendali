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

    let plotlyLayout = {};
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
        const physicalSliders = ['Ra', 'La', 'Kt', 'Kb', 'J', 'b'];
        physicalSliders.forEach(id => {
            elements[id].addEventListener('input', () => {
                elements[`${id}Value`].textContent = parseFloat(elements[id].value).toPrecision(3);
                updateSimulator(true);
            });
        });

        const controlSliders = ['Kp', 'Ki', 'Kd', 'Kf', 'Vmax'];
        controlSliders.forEach(id => {
            elements[id].addEventListener('input', () => {
                elements[`${id}Value`].textContent = elements[id].value;
                updateSimulator(true);
            });
        });

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
        
        elements.setpoint.addEventListener('input', () => updateSimulator(true));
        elements.tSim.addEventListener('input', () => updateSimulator(true));
        elements.dtSim.addEventListener('input', () => updateSimulator(true));

        elements.runButton.addEventListener('click', () => {
            if (currentSimulationData.t) {
                animateMotor(currentSimulationData);
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
        mag: (a) => Math.sqrt(a.re * a.re + a.im * a.im)
    };

    function findRoots(coeffs) {
        const n = coeffs.length - 1;
        const normCoeffs = coeffs.map(c => ({ re: c / coeffs[0], im: 0 }));
        
        let roots = [];
        const radius = 0.4 + 0.9;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n;
            roots.push({
                re: Math.pow(0.4, i) * Math.cos(angle),
                im: Math.pow(0.9, i) * Math.sin(angle)
            });
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
                const a3 = p_s2;
                const a2 = p_s1 + (Kt * Kf * Kd);
                const a1 = p_s0 + (Kt * Kf * Kp);
                const a0 = Kt * Kf * Ki;
                coeffs = [a3, a2, a1, a0];
            }
            else {
                const a4 = p_s2;
                const a3 = p_s1;
                const a2 = p_s0 + (Kt * Kf * Kd);
                const a1 = Kt * Kf * Kp;
                const a0 = Kt * Kf * Ki;
                coeffs = [a4, a3, a2, a1, a0];
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

        let polesHtml = '';
        let isUnstable = false;
        let isMarginal = false;

        roots.sort((a, b) => b.re - a.re);

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

    function updateSimulator(runSimulation) {
        const params = readParameters();
        
        if (runSimulation) {
            currentSimulationData = simulateSystem(params);
            plotResponse(currentSimulationData, params);
            updateAnalysis(currentSimulationData, params);
            updateStability(params);
        }
        
        updateDerivedParameters();
        updateTransferFunction();
    }

    function readParameters() {
        return {
            Ra: parseFloat(elements.Ra.value),
            La: parseFloat(elements.La.value),
            Kt: parseFloat(elements.Kt.value),
            Kb: parseFloat(elements.Kb.value),
            J: parseFloat(elements.J.value),
            b: parseFloat(elements.b.value),
            
            Kp: parseFloat(elements.Kp.value),
            Ki: parseFloat(elements.Ki.value),
            Kd: parseFloat(elements.Kd.value),
            
            plantType: elements.plantType.value,
            setpoint: parseFloat(elements.setpoint.value),
            
            Kf: parseFloat(elements.Kf.value),
            Vmax: parseFloat(elements.Vmax.value),
            
            tSim: Math.max(0.1, parseFloat(elements.tSim.value)),
            dt: Math.max(0.0001, parseFloat(elements.dtSim.value) / 1000),
            
            isPIDEnabled: elements.pidEnable.checked
        };
    }

    function simulateSystem(params) {
        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, Vmax, setpoint, plantType, tSim, dt, isPIDEnabled } = params;

        const nSteps = Math.floor(tSim / dt);
        const t = Array(nSteps).fill(0).map((_, i) => i * dt);

        const x1 = new Array(nSteps).fill(0);
        const x2 = new Array(nSteps).fill(0);
        const x3 = new Array(nSteps).fill(0);

        const y = new Array(nSteps).fill(0);
        const u_unclamped = new Array(nSteps).fill(0);
        const u_clamped = new Array(nSteps).fill(0);

        let integralTerm = 0;
        let prevPV = 0;

        for (let i = 1; i < nSteps; i++) {
            let clampedVoltage = 0;

            if (isPIDEnabled) {
                const pv = (plantType === '1') ? x2[i-1] : x1[i-1];
                
                const feedback = pv * Kf;
                const error = setpoint - feedback;
                const proportionalTerm = Kp * error;
                const derivativeTerm = -Kd * (pv - prevPV) / dt;
                
                const voltage = proportionalTerm + integralTerm + derivativeTerm;
                u_unclamped[i] = voltage;

                clampedVoltage = voltage;
                if (clampedVoltage > Vmax) clampedVoltage = Vmax;
                if (clampedVoltage < -Vmax) clampedVoltage = -Vmax;
                
                const isSaturated = (voltage >= Vmax && error > 0) || (voltage <= -Vmax && error < 0);
                if (!isSaturated) {
                    integralTerm += Ki * error * dt;
                }
                prevPV = pv;
            } 
            else {
                u_unclamped[i] = setpoint;
                clampedVoltage = setpoint;
                if (clampedVoltage > Vmax) clampedVoltage = Vmax;
                if (clampedVoltage < -Vmax) clampedVoltage = -Vmax;
            }
            u_clamped[i] = clampedVoltage;

            const x1_dot = x2[i-1];
            const x2_dot = (Kt * x3[i-1] - b * x2[i-1]) / J;
            const x3_dot = (clampedVoltage - Ra * x3[i-1] - Kb * x2[i-1]) / La;

            x1[i] = x1[i-1] + x1_dot * dt;
            x2[i] = x2[i-1] + x2_dot * dt;
            x3[i] = x3[i-1] + x3_dot * dt;
            
            y[i] = (plantType === '1') ? x2[i] : x1[i];
        }

        return { t, y, u_unclamped, u_clamped };
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
            xaxis: {
                title: 'Waktu (detik)',
                gridcolor: colorGrid,
            },
            yaxis: {
                title: yAxisTitle,
                gridcolor: colorGrid,
                zerolinecolor: colorPrimary,
            },
            legend: {
                orientation: 'h',
                y: -0.2,
                x: 0.5,
                xanchor: 'center'
            }
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
            xaxis: {
                title: 'Waktu (detik)',
                gridcolor: colorGrid,
            },
            yaxis: {
                title: 'Tegangan (V)',
                gridcolor: colorGrid,
                zerolinecolor: colorWarn,
                range: [-Vmax * 1.5, Vmax * 1.5]
            },
            legend: {
                orientation: 'h',
                y: -0.2,
                x: 0.5,
                xanchor: 'center'
            }
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

    function tfPoly(...terms) {
        let s = '';
        for (let i = 0; i < terms.length; i++) {
            const [val, power] = terms[i];
            if (val === 0) continue;
            
            let sign = (val > 0) ? ' + ' : ' - ';
            if (s === '' && val > 0) sign = '';
            
            let num = Math.abs(val);
            let term = '';
            
            if (num === 1 && power) {
                term = power;
            }
            else if (power) {
                term = `${num.toExponential(2)} ${power}`;
            }
            else {
                term = `${num.toExponential(2)}`;
            }
            s += `${sign}${term}`;
        }
        return s || '0';
    }

    function updateTransferFunction() {
        const p = readParameters();
        const { Ra, La, Kt, Kb, J, b, Kp, Ki, Kd, Kf, isPIDEnabled, plantType } = p;

        const plant_s2 = La * J;
        const plant_s1 = Ra * J + La * b;
        const plant_s0 = Ra * b + Kt * Kb;
        const plant_num = Kt;

        let htmlContent = '';
        let title = '';

        if (isPIDEnabled) {
            title = 'Fungsi Alih Sistem <strong>Closed-Loop</strong>: $T(s) = Y(s)/R(s)$';
            elements.toggleTfButton.textContent = 'Fungsi Alih Sistem (Closed Loop)';
            
            const C_num_s2 = Kd;
            const C_num_s1 = Kp;
            const C_num_s0 = Ki;
            const H = Kf;
            
            const numStr = tfPoly(
                [C_num_s2 * plant_num, 's^2'],
                [C_num_s1 * plant_num, 's'],
                [C_num_s0 * plant_num, '']
            );
            
            let denStr = '';
            if (plantType === '1') {
                denStr = tfPoly(
                    [plant_s2, 's^3'],
                    [plant_s1 + (C_num_s2 * plant_num * H), 's^2'],
                    [plant_s0 + (C_num_s1 * plant_num * H), 's'],
                    [C_num_s0 * plant_num * H, '']
                );
            }
            else {
                denStr = tfPoly(
                    [plant_s2, 's^4'],
                    [plant_s1, 's^3'],
                    [plant_s0 + (C_num_s2 * plant_num * H), 's^2'],
                    [C_num_s1 * plant_num * H, 's'],
                    [C_num_s0 * plant_num * H, '']
                );
            }
            htmlContent = `<p>${title}</p>$$ T(s) = \\frac{${numStr || '0'}}{${denStr || '1'}} $$`;

        }
        else {
            title = 'Fungsi Alih Sistem <strong>Open-Loop</strong>:';
            elements.toggleTfButton.textContent = 'Fungsi Alih Sistem (Open Loop)';

            const numStr = plant_num.toExponential(2);
            const denStr = tfPoly(
                [plant_s2, 's^2'],
                [plant_s1, 's'],
                [plant_s0, '']
            );

            if (plantType === '1') {
                htmlContent = `<p>${title}</p>$$ G_\\omega(s) = \\frac{\\omega(s)}{V(s)} = \\frac{${numStr}}{${denStr}} $$`;
            }
            else {
                htmlContent = `<p>${title}</p>$$ G_p(s) = \\frac{\\theta(s)}{V(s)} = \\frac{${numStr}}{s(${denStr})} $$`;
            }
        }
        
        elements.tfContainer.innerHTML = htmlContent;
        MathJax.typesetPromise([elements.tfContainer]);
    }

    function updateAnalysis(data, params) {
        const { y } = data;
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
            const maxVal = Math.max(...y);
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

        const isSaturated = data.u_clamped.some((u, i) => Math.abs(u) >= Vmax);
        if (isSaturated) {
            analysisHTML += `<li><strong>Saturasi Aktuator Terdeteksi.</strong> Sinyal kendali (tegangan) mencapai batas <strong>${Vmax} V</strong>. Ini membatasi kecepatan respons sistem.</li>`;
        }

        analysisHTML += "</ul>";
        elements.analysisContainer.innerHTML = analysisHTML;
        MathJax.typesetPromise([elements.analysisContainer]);
    }

    function animateMotor(data) {
        const { y, t } = data;
        const canvas = elements.motorCanvas;
        const ctx = canvas.getContext('2d');
        const width = 400;
        const height = 200;
        canvas.width = width;
        canvas.height = height;

        const centerX = width / 2;
        const centerY = height / 2 - 20;
        const radius = 50;
        let frame = 0;
        let animationFrameId = null;

        function drawFrame() {
            if (frame >= t.length) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
            
            let angle;
            if (elements.plantType.value === '1') {
                const dt_anim = t[1] - t[0];
                let integratedAngle = 0;
                for (let i=0; i<=frame; i++) {
                    integratedAngle += y[i] * dt_anim;
                }
                angle = integratedAngle;
            }
            else {
                angle = y[frame];
            }

            ctx.clearRect(0, 0, width, height);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 20, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0, 170, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(50, 50, 50, 1)';
            ctx.fill();
            const lineX = centerX + radius * Math.cos(angle);
            const lineY = centerY + radius * Math.sin(angle);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(lineX, lineY);
            ctx.strokeStyle = colorDanger; 
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
            ctx.fillStyle = colorDanger;
            ctx.fill();
            const displayValue = y[frame];
            ctx.font = `bold 24px ${fontMono}`;
            ctx.fillStyle = colorSecondary;
            ctx.textAlign = "center";
            ctx.fillText(displayValue.toFixed(3), centerX + radius + 20, centerY + radius + 40);
            ctx.font = `24px ${fontMain}`;
            ctx.fillStyle = colorWarn;
            ctx.fillText(elements.plantType.value === '1' ? 'Kecepatan' : 'Posisi', centerX - radius - 20, centerY + radius + 40);

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
            const valueSpan = document.getElementById(`${slider.id}-value`);
            if (valueSpan) {
                if (['La', 'J', 'b'].includes(slider.id)) {
                     valueSpan.textContent = parseFloat(slider.value).toPrecision(3);
                }
                else {
                    valueSpan.textContent = slider.value;
                }
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