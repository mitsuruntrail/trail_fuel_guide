document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calcForm');
    const resultsSection = document.getElementById('results');
    const timeResult = document.getElementById('timeResult');
    const carbResult = document.getElementById('carbResult');
    const adviceContent = document.getElementById('adviceContent');
    const productList = document.getElementById('productList');


    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculate();
    });

    function calculate() {
        // --- 1. Get Values ---
        const heightInput = document.getElementById('height');
        const weightInput = document.getElementById('weight');
        const ageInput = document.getElementById('age');
        const distInput = document.getElementById('distance');
        const elevInput = document.getElementById('elevation');

        const height = parseFloat(heightInput.value);
        const weight = parseFloat(weightInput.value);
        const age = parseFloat(ageInput.value);

        // Radios
        const genderEl = document.querySelector('input[name="gender"]:checked');
        const speedEl = document.querySelector('input[name="speed"]:checked');
        const giEl = document.querySelector('input[name="gi"]:checked');

        if (!genderEl || !speedEl || !giEl) return;

        const gender = genderEl.value;
        const dist = parseFloat(distInput.value);
        const elev = parseFloat(elevInput.value);
        const speed = parseFloat(speedEl.value);
        const giResistance = parseFloat(giEl.value);
        const useSolid = document.getElementById('solidFood').checked;

        if (isNaN(dist) || isNaN(elev) || isNaN(weight) || isNaN(age)) {
            alert('距離、標高、体重、年齢を正しく入力してください');
            return;
        }

        // --- 1.5 Calculate Calorie Burn (Estimate) ---
        // Formula: Weight (kg) * Distance (km) * 1.0 (standard coefficient)
        // Adjust coefficient for elevation roughly? Standard running is 1kcal/kg/km. 
        // Trail often higher. Let's use 1.0 base + 0.1 per 100m/km gradient? 
        // Or stick to the researched "Weight * Dist * 1.0" base logic + Elevation energy?
        // Draft said "Weight * Dist * 1.0". Let's stick to that for MVP but maybe add a slight elevation factor.
        // Actually, metabolic cost of elevation is significant. 
        // A simple trail rule: Run 1km + Elev/100m = "Flat equivalent".
        // Let's use the Flat Equivalent Distance for calories? 
        // Distance + (Elevation / 1000 * 10) -> Distance + Elevation/100 (in km)
        // Example: 40km + 2000m -> 40 + 20 = 60km equivalent.
        // Calories = Weight * 60 * 1.0. This is safer.
        const flatEquivalentDist = dist + (elev / 100);

        // --- 2. Calculate Time ---
        // Formula: (Distance / Speed) + (Elevation / 1000 * 0.6)
        const runTimeHours = (dist / speed);
        const elevTimeHours = (elev / 1000) * 0.6;
        const totalTimeHours = runTimeHours + elevTimeHours;

        // --- 2.5 Refine Calorie Burn with BMR ---
        // Mifflin-St Jeor Equation
        let bmr = 0;
        if (gender === 'male') {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }

        // Calories used for Basal Metabolism during the race duration
        const raceBMRBurn = (bmr / 24) * totalTimeHours;

        // Activity Burn (Weight * FlatEquivalentDist * 1.0)
        const activityBurn = weight * flatEquivalentDist;

        // Total = Activity + BMR during race
        // (Note: This is still an estimate, but improved by adding base life cost)
        const totalCalories = Math.round(activityBurn + raceBMRBurn);

        // --- 3. Calculate Fuel Needs ---
        // Refuel starts after 30 mins.
        // Duration to refuel = Total Time - 0.5 hours
        const refuelDuration = Math.max(0, totalTimeHours - 0.5);

        // Total Carbs = Refuel Duration * GI Rate
        const totalCarbs = Math.ceil(refuelDuration * giResistance);

        // --- 4. Product Logic ---
        const products = [];

        // A. Gels
        // 1 Gel = approx 30g carbs (simplification for general logic, though Mag-on is around 30g)
        // Base Gel Count = ceil(Total Carbs / 30) + 1 (Insurance)
        let gelCount = Math.ceil(totalCarbs / 30) + 1;
        let solidCount = 0;

        // B. Solids (PowerBar/Clif)
        // Only if time >= 3 hours and user checked box
        if (useSolid && totalTimeHours >= 3) {
            // 1 bar every 3 hours
            solidCount = Math.floor(totalTimeHours / 3);
            // Subtract solid carb equivalent from gels (1 bar ~= 1 gel roughly for count replacement in logic, actually bars are often 40-50g but logic says "replace 1 gel")
            // The prompt says "Each bar replaces one gel in the count"
            gelCount = Math.max(0, gelCount - solidCount);
        }

        // C. Electrolytes (Medalist) -> 1 per hour
        const electrolyteCount = Math.ceil(totalTimeHours);

        // D. Recovery/BCAA (Amino Vital Gold)
        // 1 before start + 1 every 3.5h if time > 4h
        let bcaaCount = 1; // Start
        if (totalTimeHours > 4) {
            bcaaCount += Math.floor(totalTimeHours / 3.5);
        }

        // E. Emergency (OS-1 Powder) -> Always 1
        const os1Count = 1;

        // --- 5. Format & Display ---

        // --- 5. Format & Display ---

        // Helper to format time (e.g. 7.86h -> 7時間51分)
        const hours = Math.floor(totalTimeHours);
        const minutes = Math.round((totalTimeHours - hours) * 60);
        timeResult.textContent = `${hours}時間${minutes}分`;

        carbResult.textContent = totalCarbs;

        // --- NEW: Hydration Calculation ---
        // Step 1: Base Water (Speed based)
        // Fast(7.0)->600, Normal(6.0)->500, Slow(5.0)->400
        let waterRate = 500;
        if (speed === 7.0) waterRate = 600;
        if (speed === 5.0) waterRate = 400;

        const baseWater = totalTimeHours * waterRate;

        // Step 2: Elevation Adjustment
        let totalWater = baseWater;
        if (elev >= 5000) {
            totalWater = baseWater * 1.2;
        } else if (elev >= 3000) {
            totalWater = baseWater * 1.1;
        }

        // Step 4: OS-1 Ratio
        let os1Ratio = 0.3; // Default
        if (elev >= 5000) {
            os1Ratio = 0.5; // High altitude fixed
        } else if (totalTimeHours >= 8) {
            // Long duration: 40-60% -> let's use 50% average
            os1Ratio = 0.5;
        }

        // Step 5: OS-1 Count
        const os1Volume = totalWater * os1Ratio;
        let os1Packs = Math.ceil(os1Volume / 500); // 1 pack = 500ml
        // Minimum 2 packs display rule
        if (os1Packs < 2) os1Packs = 2;

        // Round Water Volume for display
        const displayWater = Math.round(totalWater / 100) * 100; // Round to nearest 100ml

        // Create Advice Text
        let adviceHTML = '';

        // Block 1: Global Summary
        adviceHTML += `<div class="advice-block">
            <span class="advice-title">補給プラン概要</span>
            <p>予想タイム: <strong>${hours}時間${minutes}分</strong><br>
            推定消費カロリー: <strong>約${totalCalories}kcal</strong><br>
            レース開始30分後から補給を開始し、合計で<strong>${totalCarbs}g</strong>の炭水化物を摂取してください。<br>
            ${totalTimeHours > 3 ? '長丁場になるため、定期的な電解質補給とリズムを作るための固形物摂取が鍵となります。' : '短時間のレースですが、エネルギー切れ（ハンガーノック）を防ぐため早めのジェル摂取を心がけてください。'}
        </div>`;

        // Block 2: GI Specifics
        adviceHTML += `<div class="advice-block">
            <span class="advice-title">胃腸・摂取ペース</span>
            <p>あなたの設定（${getGiLabel(giResistance)}）に基づき、<strong>1時間あたり約${giResistance}g</strong>の炭水化物摂取を目安に計算しています。</p>
            ${giResistance === 60 ? '胃腸は強いタイプですが、油断せず定期的に摂取してください。' : '胃腸トラブルのリスクを考慮し、少し抑えめのペースで設定しています。一気に飲まず、こまめに摂取するのがポイントです。'}
        </div>`;

        // Block 3: Safety/Water (UPDATED)
        adviceHTML += `<div class="advice-block">
            <span class="advice-title">安全・水分管理</span>
            <p>
                必要水分量：<strong>約${displayWater.toLocaleString()} ml</strong><br>
                OS-1（粉末）：<strong>${os1Packs}包</strong> <small>（500ml × ${os1Packs}）</small>
            </p>
            <p style="font-size:12px; color:#aaa; margin-top:5px;">※発汗量を考慮した目安です。${totalTimeHours >= 8 || elev >= 3000 ? '長時間・高低差のあるルートを想定しています。' : ''}携帯分だけでなくエイドでの補給も含みます。</p>
            緊急用のOS-1パウダーは必ず携帯し、足つりや脱水の兆候があれば迷わず使用してください。
        </div>`;

        adviceContent.innerHTML = adviceHTML;

        // --- One-Point Advice Feature ---
        const adviceData = generateOnePointAdvice(totalTimeHours, dist, elev, speed, giResistance, useSolid);
        adviceContent.innerHTML += adviceData.html;

        // --- Calculate Intake Calories from Products ---
        // Gel ~100kcal, Solid ~200kcal, Electrolyte ~20kcal, BCAA ~20kcal, OS-1 ~20kcal
        const intakeFromGels = gelCount * 100;
        const intakeFromSolids = solidCount * 200;
        const intakeFromOthers = (electrolyteCount * 20) + (bcaaCount * 20) + (os1Packs * 20); // Updated OS-1 Count
        const totalIntake = intakeFromGels + intakeFromSolids + intakeFromOthers;

        // Build Product List
        productList.innerHTML = '';

        // Header for Product List (Total Calorie Info)
        const summaryLi = document.createElement('li');
        summaryLi.style.cssText = 'padding: 15px; background: #333; margin-bottom: 10px; border-radius: 4px; text-align: center;';
        summaryLi.innerHTML = `
            <div style="font-size: 14px; color: #fff; margin-bottom:5px; font-weight:bold;">補給食合計カロリー</div>
            <div style="font-size: 28px; font-weight: 800; color: #e6ff00; line-height:1.2;">約${totalIntake}kcal</div>
            <div style="color:#aaa; font-size:11px; margin-top:8px;">(消費予想 ${Math.round(totalCalories / 2)}〜${Math.round(totalCalories * 0.7)}kcal程度を補給でカバーします)</div>
        `;
        productList.appendChild(summaryLi);

        // Add Items categories

        // 1. Gels (Variety)
        const gelLi = document.createElement('li');
        gelLi.className = 'product-item';
        gelLi.innerHTML = `
            <img src="https://placehold.co/80x80/e6ff00/000?text=GEL" alt="Gel" class="product-thumb">
            <div style="flex:1">
                <div class="product-name">エナジージェル (推奨: ${gelCount}個)</div>
                <div class="product-desc" style="margin-top:5px; line-height:1.4;">
                    <div style="margin-bottom:8px;">味や食感を変えて飽きを防止しましょう:</div>
                    
                    <div class="product-row">
                        <span><strong>Mag-on</strong> (マグネシウム入)</span>
                        <a href="https://www.amazon.co.jp/s?k=Mag-on+%E3%82%A8%E3%83%8A%E3%82%B8%E3%83%BC%E3%82%B8%E3%82%A7%E3%83%AB" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                    
                    <div class="product-row">
                        <span><strong>俺は摂取す</strong> (リカバリ系)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E4%BF%BA%E3%81%AF%E6%91%82%E5%8F%96%E3%81%99" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                    
                    <div class="product-row">
                        <span><strong>GU Energy</strong> (濃厚)</span>
                        <a href="https://www.amazon.co.jp/s?k=GU+Energy+Gel" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>

                    <div class="product-row">
                        <span><strong>MAURTEN 100</strong> (高機能)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E3%83%A2%E3%83%AB%E3%83%86%E3%83%B3+%E3%82%B8%E3%82%A7%E3%83%AB" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                </div>
            </div>
        `;
        productList.appendChild(gelLi);

        if (solidCount > 0) {
            const solidLi = document.createElement('li');
            solidLi.className = 'product-item';
            solidLi.innerHTML = `
                <img src="https://placehold.co/80x80/green/fff?text=SOLID" alt="Solid" class="product-thumb">
                <div style="flex:1">
                <div class="product-name">固形食 (推奨: ${solidCount}個)</div>
                <div class="product-desc" style="margin-top:5px; line-height:1.4;">
                    <div style="margin-bottom:8px;">腹持ちの良いものを混ぜましょう:</div>
                    
                    <div class="product-row">
                        <span><strong>Enemochi</strong> (お餅)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E3%82%A8%E3%83%8D%E3%83%A2%E3%83%81" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                    
                    <div class="product-row">
                        <span><strong>スポーツようかん</strong></span>
                        <a href="https://www.amazon.co.jp/s?k=%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%84%E3%82%88%E3%81%86%E3%81%8B%E3%82%93" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                    
                    <div class="product-row">
                        <span><strong>PowerBar</strong> (海外定番)</span>
                        <a href="https://www.amazon.co.jp/s?k=PowerBar+%E3%82%A8%E3%83%8A%E3%82%B8%E3%83%BC%E3%83%90%E3%83%BC" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                </div>
            </div>
            `;
            productList.appendChild(solidLi);
        }
        // C. Electrolytes (Medalist / Umeboshi)
        const electrolyteLi = document.createElement('li');
        electrolyteLi.className = 'product-item';
        electrolyteLi.innerHTML = `
            <img src="https://placehold.co/80x80/orange/fff?text=SALT" alt="Salt" class="product-thumb">
            <div style="flex:1">
                <div class="product-name">ナトリウム (塩分) (推奨: ${electrolyteCount}回分)</div>
                <div class="product-desc" style="margin-top:5px; line-height:1.4;">
                    <div style="margin-bottom:8px;">足つり予防に必須です:</div>
                    
                    <div class="product-row">
                        <span><strong>メダリスト</strong> (クエン酸)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E3%83%A1%E3%83%80%E3%83%AA%E3%82%B9%E3%83%88+%E3%82%AF%E3%82%A8%E3%83%B3%E9%85%B8" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                    
                    <div class="product-row">
                        <span><strong>梅干し純</strong> (タブレット)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E6%A2%85%E5%B9%B2%E3%81%97%E7%B4%94" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>

                     <div class="product-row">
                        <span><strong>塩熱サプリ</strong> (電解質)</span>
                        <a href="https://www.amazon.co.jp/s?k=%E5%A1%A9%E7%86%B1%E3%82%B5%E3%83%97%E3%83%AA" target="_blank" class="amazon-btn">Amazonで購入</a>
                    </div>
                </div>
            </div>
        `;
        productList.appendChild(electrolyteLi);
        addProduct(products, 'BCAA/回復系', 'アミノバイタル GOLD', bcaaCount + '本', 'https://www.amazon.co.jp/s?k=%E3%82%A2%E3%83%9F%E3%83%8E%E3%83%90%E3%82%A4%E3%82%BF%E3%83%AB+GOLD', 'https://placehold.co/80x80/blue/fff?text=BCAA');
        addProduct(products, '脱水予防', 'OS-1 パウダー', os1Packs + '袋', 'https://www.amazon.co.jp/s?k=OS-1+%E3%83%91%E3%82%A6%E3%83%80%E3%83%BC', 'https://placehold.co/80x80/ffffff/000080?text=OS-1');

        // Setup Buy Button (Combined Search) - REMOVED
        // buyAllBtn.href = ...;
        // buyAllBtn.textContent = ...;

        resultsSection.classList.remove('hidden');

        // Append Social Buttons
        const socialContainer = document.getElementById('socialContainer');
        if (!socialContainer) {
            const div = document.createElement('div');
            div.id = 'socialContainer';
            resultsSection.appendChild(div);
        }

        // Pass item counts for summary
        renderSocialButtons(hours, minutes, totalCalories, dist, elev, adviceData);

        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function addProduct(list, category, name, qty, link, imgUrl) {
        const li = document.createElement('li');
        li.className = 'product-item';
        li.innerHTML = `
            <img src="${imgUrl}" alt="${category}" class="product-thumb">
            <div style="flex:1">
                <div class="product-name">${category}</div>
                <div class="product-desc" style="margin-top:5px; line-height:1.4;">
                    <span>${name}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                <span class="product-qty">${qty}</span>
                <a href="${link}" target="_blank" class="amazon-btn">Amazonで購入</a>
            </div>
        `;
        productList.appendChild(li);
    }

    function getGiLabel(val) {
        if (val === 60) return '胃腸: 強い';
        if (val === 55) return '胃腸: 普通';
        return '胃腸: 弱い';
    }

    function generateOnePointAdvice(time, dist, elev, speedVal, giVal, solid) {
        // --- 1. Product & URL Definition ---
        const products = {
            'アミノバイタル GOLD': {
                url: 'https://www.amazon.co.jp/s?k=%E3%82%A2%E3%83%9F%E3%83%8E%E3%83%90%E3%82%A4%E3%82%BF%E3%83%AB+GOLD',
                defaultReason: '筋疲労サポート'
            },
            'メダリスト 塩ジェル': {
                url: 'https://www.amazon.co.jp/s?k=%E3%83%A1%E3%83%80%E3%83%AA%E3%82%B9%E3%83%88+%E5%A1%A9%E3%82%B8%E3%82%A7%E3%83%AB',
                defaultReason: '攣り予防・ミネラル'
            },
            'OS-1 パウダー': {
                url: 'https://www.amazon.co.jp/s?k=OS-1+%E3%83%91%E3%82%A6%E3%83%80%E3%83%BC',
                defaultReason: '脱水・電解質補給'
            },
            'GU Energy（カフェイン）': {
                url: 'https://www.amazon.co.jp/s?k=GU+Energy+Gel+Caffeine',
                defaultReason: '集中力・覚醒'
            },
            'Mag-on ジェル': {
                url: 'https://www.amazon.co.jp/s?k=Mag-on+%E3%82%A8%E3%83%8A%E3%82%B8%E3%83%BC%E3%82%B8%E3%82%A7%E3%83%AB',
                defaultReason: 'エネルギー・Mg'
            },
            'アミノバイタル 粉末': {
                url: 'https://www.amazon.co.jp/s?k=%E3%82%A2%E3%83%9F%E3%83%8E%E3%83%90%E3%82%A4%E3%82%BF%E3%83%AB+%E3%82%AF%E3%82%A8%E3%83%B3%E9%85%B8',
                defaultReason: '胃腸負担軽減'
            }
        };

        // --- 2. Advice Database (50 items) ---
        // Groups: 1-15 (legs), 16-30 (water), 31-50 (energy)
        const adviceList = [
            // --- Group 1: Legs (1-15) ---
            { id: 1, group: 'legs', msg: "長時間走ではマグネシウム不足が脚攣りの原因になることも。早め対策が安心。", prod: "アミノバイタル GOLD", reason: "筋疲労サポート" },
            { id: 2, group: 'legs', msg: "攣りは突然来ます。違和感を感じたら塩分＋ミネラルを意識。", prod: "メダリスト 塩ジェル", reason: "攣り予防" },
            { id: 3, group: 'legs', msg: "下りが続くと筋ダメージが蓄積。アミノ酸補給で後半を楽に。", prod: "アミノバイタル GOLD", reason: "筋などダメージ軽減" },
            { id: 4, group: 'legs', msg: "脚がピクッとしたら要注意。ミネラル切れのサインかも。", prod: "メダリスト 塩ジェル", reason: "ミネラル即補給" },
            { id: 5, group: 'legs', msg: "汗でマグネシウムも流れます。水だけ補給は要注意。", prod: "OS-1 パウダー", reason: "電解質バランス" },
            { id: 6, group: 'legs', msg: "攣りは疲労＋脱水の合わせ技。どちらも同時にケアを。", prod: "アミノバイタル GOLD", reason: "疲労回復" },
            { id: 7, group: 'legs', msg: "後半の脚攣り対策は“起きてから”ではなく“起きる前”。", prod: "メダリスト 塩ジェル", reason: "事前予防" },
            { id: 8, group: 'legs', msg: "脚の重さは筋疲労の蓄積。アミノ酸は早めが効果的。", prod: "アミノバイタル GOLD", reason: "疲労抜き" },
            { id: 9, group: 'legs', msg: "攣りやすい人は1時間ごとの塩分補給を意識してみて。", prod: "メダリスト 塩ジェル", reason: "定期的ミネラル" },
            { id: 10, group: 'legs', msg: "暑い日は特にミネラル不足に注意。汗＝水だけじゃない。", prod: "OS-1 パウダー", reason: "発汗対策" },
            { id: 11, group: 'legs', msg: "攣り対策は“量”より“タイミング”。少量をこまめに。", prod: "アミノバイタル GOLD", reason: "回復サイクル" },
            { id: 12, group: 'legs', msg: "脚攣りは突然。携帯しやすい補給が安心材料になります。", prod: "メダリスト 塩ジェル", reason: "携帯性抜群" },
            { id: 13, group: 'legs', msg: "筋疲労が溜まる前にアミノ酸。後半の動きが変わります。", prod: "アミノバイタル GOLD", reason: "後半の粘り" },
            { id: 14, group: 'legs', msg: "長丁場ではミネラル不足が見えにくい。定期補給を。", prod: "OS-1 パウダー", reason: "隠れ脱水防止" },
            { id: 15, group: 'legs', msg: "攣り経験がある人ほど“予防補給”を習慣に。", prod: "メダリスト 塩ジェル", reason: "習慣化" },

            // --- Group 2: Water (16-30) ---
            { id: 16, group: 'water', msg: "喉が渇く前の補給が理想。脱水は気づいた時には遅れがち。", prod: "OS-1 パウダー", reason: "早めの水分補給" },
            { id: 17, group: 'water', msg: "汗量が多い日は水だけ補給だと逆効果になることも。", prod: "OS-1 パウダー", reason: "低ナトリウム予防" },
            { id: 18, group: 'water', msg: "暑さ＋標高差は脱水リスク大。電解質も忘れずに。", prod: "OS-1 パウダー", reason: "環境変化に対応" },
            { id: 19, group: 'water', msg: "軽い頭痛やだるさは脱水サインかもしれません。", prod: "OS-1 パウダー", reason: "脱水シグナル" },
            { id: 20, group: 'water', msg: "発汗が多い日は塩分不足に注意。味が薄く感じたら要警戒。", prod: "メダリスト 塩ジェル", reason: "塩分センサー" },
            { id: 21, group: 'water', msg: "塩分は“後半まとめて”より“前半から少しずつ”。", prod: "メダリスト 塩ジェル", reason: "積立補給" },
            { id: 22, group: 'water', msg: "水分補給は量より頻度。こまめが正解。", prod: "OS-1 パウダー", reason: "吸収効率UP" },
            { id: 23, group: 'water', msg: "長時間走では知らないうちに電解質が枯渇します。", prod: "OS-1 パウダー", reason: "電解質維持" },
            { id: 24, group: 'water', msg: "足攣り・集中力低下、どちらも塩分不足が原因の場合も。", prod: "メダリスト 塩ジェル", reason: "トラブル回避" },
            { id: 25, group: 'water', msg: "暑くなくても脱水は起こります。季節に関係なく注意。", prod: "OS-1 パウダー", reason: "冬の脱水警戒" },
            { id: 26, group: 'water', msg: "塩分補給は“汗をかいた実感”を目安に。", prod: "メダリスト 塩ジェル", reason: "発汗目安" },
            { id: 27, group: 'water', msg: "喉が渇いた時点で軽い脱水。先回り補給を。", prod: "OS-1 パウダー", reason: "先回り" },
            { id: 28, group: 'water', msg: "標高が上がると発汗量も変化。電解質を意識。", prod: "OS-1 パウダー", reason: "高地の発汗" },
            { id: 29, group: 'water', msg: "塩分が足りないと胃も不調になりがち。", prod: "メダリスト 塩ジェル", reason: "胃腸ケア" },
            { id: 30, group: 'water', msg: "水分・塩分・糖質。どれか欠けるとバランスが崩れます。", prod: "OS-1 パウダー", reason: "三大要素" },

            // --- Group 3: Energy/GE/Focus (31-50) ---
            { id: 31, group: 'energy', msg: "後半の判断力低下はエネルギー切れのサインかも。", prod: "GU Energy（カフェイン）", reason: "脳の栄養" },
            { id: 32, group: 'energy', msg: "集中力が落ちたら少量の糖質補給が効果的。", prod: "Mag-on ジェル", reason: "即攻エネルギー" },
            { id: 33, group: 'energy', msg: "胃が重い時は濃すぎない補給が安心。", prod: "アミノバイタル 粉末", reason: "サラッと摂取" },
            { id: 34, group: 'energy', msg: "甘い物が辛くなる前に味の切り替えを。", prod: "アミノバイタル GOLD", reason: "味変効果" },
            { id: 35, group: 'energy', msg: "長時間では胃腸疲労も起きやすい。飲み物補給が楽な場合も。", prod: "アミノバイタル 粉末", reason: "流し込みやすい" },
            { id: 36, group: 'energy', msg: "エネルギー切れは突然。早め補給が安全。", prod: "Mag-on ジェル", reason: "ハンガーノック予防" },
            { id: 37, group: 'energy', msg: "眠気やぼーっと感は糖質不足の可能性。", prod: "GU Energy（カフェイン）", reason: "眠気覚まし" },
            { id: 38, group: 'energy', msg: "胃腸に優しい補給は後半の安定感につながります。", prod: "アミノバイタル 粉末", reason: "胃もたれ防止" },
            { id: 39, group: 'energy', msg: "集中力維持は完走率アップの鍵。", prod: "GU Energy（カフェイン）", reason: "完走サポート" },
            { id: 40, group: 'energy', msg: "空腹を感じてからでは遅れがち。定期補給を意識。", prod: "Mag-on ジェル", reason: "定刻補給" },
            { id: 41, group: 'energy', msg: "胃が受け付けない日は無理せず液体補給。", prod: "アミノバイタル 粉末", reason: "液体エネルギー" },
            { id: 42, group: 'energy', msg: "補給の間隔が空くと一気に失速しがち。", prod: "Mag-on ジェル", reason: "ペース維持" },
            { id: 43, group: 'energy', msg: "後半に向けて味の選択肢を残すのも戦略。", prod: "アミノバイタル GOLD", reason: "飽き対策" },
            { id: 44, group: 'energy', msg: "集中力低下は転倒リスクにもつながります。", prod: "GU Energy（カフェイン）", reason: "安全確保" },
            { id: 45, group: 'energy', msg: "胃腸トラブル予防は“少量・頻回”が基本。", prod: "アミノバイタル 粉末", reason: "分割摂取" },
            { id: 46, group: 'energy', msg: "エネルギー切れを作らないことが最大の安全対策。", prod: "Mag-on ジェル", reason: "安全第一" },
            { id: 47, group: 'energy', msg: "甘さが辛くなったら無理せず切り替え。", prod: "アミノバイタル GOLD", reason: "リフレッシュ" },
            { id: 48, group: 'energy', msg: "後半の粘りは前半の補給で決まります。", prod: "Mag-on ジェル", reason: "貯金を作る" },
            { id: 49, group: 'energy', msg: "集中が切れたら一度立て直し補給を。", prod: "GU Energy（カフェイン）", reason: "リセット" },
            { id: 50, group: 'energy', msg: "長時間走は“耐える”より“整える”補給を。", prod: "アミノバイタル GOLD", reason: "コンディショニング" }
        ];

        // --- 3. Selection Logic ---
        let targetGroup = 'random';
        // Priority Logic
        if (elev > 2000) {
            targetGroup = 'legs'; // High elevation = muscle strain
        } else if (time > 6 || giVal === 50) {
            targetGroup = 'energy'; // Long duration or weak GI
        } else if (dist > 30) {
            targetGroup = 'legs'; // Distance = muscle fatigue
        } else {
            // Default mix or weigh slightly towards water/legs
            const r = Math.random();
            if (r < 0.4) targetGroup = 'legs';
            else if (r < 0.7) targetGroup = 'water';
            else targetGroup = 'energy';
        }

        // Filter list
        let candidates = adviceList.filter(item => item.group === targetGroup);

        // Safety Fallback (shouldn't happen with this logic, but good practice)
        if (candidates.length === 0) candidates = adviceList;

        // Pick Random
        const advice = candidates[Math.floor(Math.random() * candidates.length)];
        const prodData = products[advice.prod] || { url: '#', defaultReason: advice.reason };
        const reason = advice.reason || prodData.defaultReason;

        // --- 4. Render HTML ---
        return {
            msg: advice.msg,
            prod: advice.prod,
            reason: reason,
            html: `
            <div class="advice-box">
                <div class="advice-header">本日のワンポイント：</div>
                <div class="advice-msg">「${advice.msg}」</div>
                <div class="advice-rec">
                    <div>
                        ▶ おすすめ：<strong>${advice.prod}</strong><br>
                        <span class="advice-reason">（${reason}）</span>
                    </div>
                    <a href="${prodData.url}" target="_blank" class="amazon-btn">Amazonで購入</a>
                </div>
            </div>
        `};
    }

    function renderSocialButtons(hours, minutes, calories, distance, elevation, adviceData) {
        const socialDiv = document.getElementById('socialContainer');

        const url = window.location.href;
        const text = `トレイル補給ナビ: 予想タイム${hours}時間${minutes}分、消費 ${calories}kcal。 #TrailFuelGuide`;
        const encodedText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(url);

        // Placeholder for HTML structure
        socialDiv.innerHTML = `
            <div class="social-share" style="margin-top:40px; text-align:center; border-top:1px solid #333; padding-top:20px;">
                
                <div id="shareWrapper" style="margin-bottom:20px; display:flex; justify-content:center;">
                    <img id="shareImage" src="" style="max-width:100%; border-radius:8px; border:1px solid #333; min-height:200px; background:#1e1e1e;" alt="画像を生成中...">
                    <!-- Canvas will be appended here if image generation fails -->
                </div>

                <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                    <button id="nativeShareBtn" style="background:#e6ff00; color:#000; padding:12px 24px; border-radius:4px; border:none; font-weight:bold; font-size:14px; cursor:pointer; width:100%; max-width:300px; margin-bottom:10px;">画像をシェアする (アプリで開く)</button>
                </div>

                <div style="display:flex; justify-content:center; gap:10px;">
                    <a href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" style="background:#000; color:#fff; padding:10px 20px; border-radius:4px; text-decoration:none; border:1px solid #333; font-size:14px;">𝕏 (Twitter)</a>
                    <a href="https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}" target="_blank" style="background:#000; color:#fff; padding:10px 20px; border-radius:4px; text-decoration:none; border:1px solid #333; font-size:14px;">Threads</a>
                    <a href="http://www.facebook.com/share.php?u=${encodedUrl}" target="_blank" style="background:#3b5998; color:#fff; padding:10px 20px; border-radius:4px; text-decoration:none; font-size:14px;">Facebook</a>
                </div>
            </div>
        `;

        // Native Share Event Listener (Attached after HTML insertion)
        setTimeout(() => {
            const shareBtn = document.getElementById('nativeShareBtn');
            if (shareBtn) {
                shareBtn.addEventListener('click', async () => {
                    const canvas = document.getElementById('shareCanvas');
                    // Ensure canvas exists and has content (we use the hidden canvas source)
                    if (!canvas) {
                        alert('画像生成中です。少々お待ちください。');
                        return;
                    }

                    try {
                        canvas.toBlob(async (blob) => {
                            if (!blob) {
                                alert('画像の生成に失敗しました。(Tainted Canvas)');
                                return;
                            }

                            const file = new File([blob], "trail_fuel_result.png", { type: "image/png" });

                            if (navigator.share) {
                                try {
                                    await navigator.share({
                                        title: 'Trail Fuel Guide 結果',
                                        text: text,
                                        url: window.location.href,
                                        files: [file]
                                    });
                                } catch (err) {
                                    if (err.name !== 'AbortError') {
                                        console.error('Share failed', err);
                                        alert('シェアに失敗しました。画像を長押しして保存してください。');
                                    }
                                }
                            } else {
                                alert('お使いのブラウザはこの機能に対応していません。\n画像を長押し(または右クリック)して保存し、手動でシェアしてください。');
                            }
                        }, 'image/png');
                    } catch (e) {
                        console.error('Blob conversion failed (Security Error likely)', e);
                        alert('セキュリティ制限により画像を自動添付できませんでした。\n画像を長押し(または右クリック)して保存し、手動でシェアしてください。');
                    }
                });
            }
        }, 500);

        // Generate canvas after a short delay to ensure fonts are loaded
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.id = 'shareCanvas'; // ID for styling/referencing
            canvas.width = 600;
            canvas.height = 550; // Increased height for advice
            // Style canvas to match img (hidden by default)
            canvas.style.maxWidth = '100%';
            canvas.style.borderRadius = '8px';
            canvas.style.border = '1px solid #333';
            canvas.style.display = 'none'; // Hidden by default

            document.getElementById('shareWrapper').appendChild(canvas);

            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, 600, 550);

            // Draw Logo Icon (Async)
            const logo = new Image();

            const drawContent = (logoImg) => {
                let offsetY = 30;

                // Logo Icon
                if (logoImg) {
                    const iconW = 240;
                    const iconH = (logoImg.naturalHeight / logoImg.naturalWidth) * iconW;
                    ctx.drawImage(logoImg, (600 - iconW) / 2, offsetY, iconW, iconH);
                    offsetY += iconH + 15;
                } else {
                    // Fallback Circle
                    ctx.fillStyle = '#e6ff00';
                    ctx.beginPath();
                    ctx.arc(300, 60, 35, 0, Math.PI * 2);
                    ctx.fill();
                    offsetY = 110;
                }

                offsetY += 20;

                // Divider
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(80, offsetY);
                ctx.lineTo(520, offsetY);
                ctx.stroke();

                offsetY += 40;

                // 4 Metrics in 2x2 Grid
                const leftX = 100;
                const rightX = 350;
                const rowSpacing = 90;

                // Row 1: Distance and Elevation
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '500 15px "Noto Sans JP", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('距離', leftX, offsetY);
                ctx.fillText('累積標高', rightX, offsetY);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 32px Inter, sans-serif';
                ctx.fillText(`${distance} km`, leftX, offsetY + 40);
                ctx.fillText(`${elevation} m`, rightX, offsetY + 40);

                offsetY += rowSpacing;

                // Row 2: Time and Calories
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '500 15px "Noto Sans JP", sans-serif';
                ctx.fillText('予想タイム', leftX, offsetY);
                ctx.fillText('消費カロリー', rightX, offsetY);

                ctx.fillStyle = '#e6ff00';
                ctx.font = 'bold 32px Inter, sans-serif';
                ctx.fillText(`${hours}h ${minutes}m`, leftX, offsetY + 40);
                ctx.fillText(`${calories} kcal`, rightX, offsetY + 40);

                offsetY += 70;

                // Divider 2
                ctx.strokeStyle = '#333';
                ctx.beginPath();
                ctx.moveTo(80, offsetY);
                ctx.lineTo(520, offsetY);
                ctx.stroke();
                offsetY += 30;

                // Advice Section
                ctx.fillStyle = '#e6ff00';
                ctx.font = '700 16px "Noto Sans JP", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('本日のワンポイント', 300, offsetY);
                offsetY += 35;

                ctx.fillStyle = '#ffffff';
                ctx.font = '500 18px "Noto Sans JP", sans-serif';
                ctx.textAlign = 'center';

                // Simple text wrap
                const maxW = 500;
                const words = (adviceData.msg || '').split('');
                let line = '';

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n];
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxW && n > 0) {
                        ctx.fillText(line, 300, offsetY);
                        line = words[n];
                        offsetY += 28;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, 300, offsetY);
                offsetY += 35;

                // Advice Recommendation
                if (adviceData.prod) {
                    ctx.fillStyle = '#e6ff00';
                    ctx.font = '700 16px "Noto Sans JP", sans-serif'; // Slightly smaller/different weight
                    ctx.textAlign = 'center';
                    ctx.fillText(`▶ おすすめ: ${adviceData.prod}`, 300, offsetY);
                    offsetY += 25;

                    ctx.fillStyle = '#aaaaaa';
                    ctx.font = '14px "Noto Sans JP", sans-serif';
                    ctx.fillText(`(${adviceData.reason})`, 300, offsetY);
                }

                // Finalize Image with Error Handling
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    const imgTag = document.getElementById('shareImage');
                    if (imgTag) {
                        imgTag.src = dataUrl;
                        imgTag.alt = 'トレイル補給ナビ - 計算結果';
                    }
                } catch (e) {
                    console.warn('Canvas export failed (likely CORS), showing canvas fallback:', e);
                    const imgTag = document.getElementById('shareImage');
                    if (imgTag) {
                        imgTag.style.display = 'none'; // Hide broken image
                    }
                    canvas.style.display = 'block'; // Show canvas instead
                }
            };

            logo.onload = () => drawContent(logo);
            logo.onerror = () => drawContent(null);

            // Now set src to trigger load
            logo.src = 'logo_v3.png';

            // Trigger immediately if logo fails to load within 1 second (safety net)
            setTimeout(() => {
                const imgTag = document.getElementById('shareImage');
                // Check if img has src set (success) OR canvas is displayed (fallback success)
                const isSuccess = (imgTag && imgTag.src.startsWith('data:')) || (canvas.style.display === 'block');

                if (!isSuccess) {
                    drawContent(null);
                }
            }, 1000);
        }, 300);
    }

    // --- Persistence Logic ---
    function saveInputs() {
        const data = {
            height: document.getElementById('height').value,
            weight: document.getElementById('weight').value,
            age: document.getElementById('age').value,
            distance: document.getElementById('distance').value,
            elevation: document.getElementById('elevation').value,
            gender: document.querySelector('input[name="gender"]:checked')?.value,
            speed: document.querySelector('input[name="speed"]:checked')?.value,
            gi: document.querySelector('input[name="gi"]:checked')?.value,
            solidFood: document.getElementById('solidFood').checked
        };
        localStorage.setItem('trailFuelData', JSON.stringify(data));
    }

    function loadInputs() {
        const saved = localStorage.getItem('trailFuelData');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            if (data.height) document.getElementById('height').value = data.height;
            if (data.weight) document.getElementById('weight').value = data.weight;
            if (data.age) document.getElementById('age').value = data.age;
            if (data.distance) document.getElementById('distance').value = data.distance;
            if (data.elevation) document.getElementById('elevation').value = data.elevation;

            if (data.gender) {
                const el = document.querySelector(`input[name="gender"][value="${data.gender}"]`);
                if (el) el.checked = true;
            }
            if (data.speed) {
                const el = document.querySelector(`input[name="speed"][value="${data.speed}"]`);
                if (el) el.checked = true;
            }
            if (data.gi) {
                const el = document.querySelector(`input[name="gi"][value="${data.gi}"]`);
                if (el) el.checked = true;
            }
            if (data.solidFood !== undefined) {
                document.getElementById('solidFood').checked = data.solidFood;
            }
        } catch (e) {
            console.error('Save data load failed', e);
        }
    }

    // Init Persistence
    loadInputs();
    form.addEventListener('input', saveInputs);
    form.addEventListener('change', saveInputs);
});
