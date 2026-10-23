import{ay as y,az as S,H as p}from"./index-BqSXLff6.js";const g="ai_responses_cache",$=async(t,c,s)=>{var r,a,m,f,h;try{const i=await y.get(g,t);if(i&&Date.now()-i.timestamp<1800*1e3)return console.log(`🤖 استفاده از پاسخ کش‌شده هوش مصنوعی برای کلید: ${t}`),i.response}catch{}if(typeof navigator<"u"&&!navigator.onLine)throw new Error("OFFLINE_MODE");const n={contents:c},e=new AbortController,o=setTimeout(()=>e.abort(),15e3);try{const i=await fetch(`${S.BASE_URL}/gemini-api.php`,{method:"POST",headers:{"Content-Type":"application/json",...await p.getSecureHeaders()},body:JSON.stringify(n),signal:e.signal});if(!i.ok)throw new Error(`Gemini API Error ${i.status}`);const l=((h=(f=(m=(a=(r=(await i.json()).candidates)==null?void 0:r[0])==null?void 0:a.content)==null?void 0:m.parts)==null?void 0:f[0])==null?void 0:h.text)||"";return l&&y.save(g,{id:t,response:l,timestamp:Date.now()}).catch(()=>{}),l}finally{clearTimeout(o)}},d=async(t,c)=>{const s=`stock_analysis_${t.length}_${c.length}`;try{const n=`
      به عنوان یک تحلیلگر انبار هوشمند (AI Inventory Auditor)، داده‌های زیر را به دقت بررسی کن:
      ۱. لیست کالاها و موجودی فعلی: ${JSON.stringify(t.map(e=>({name:e.name,stock:e.stock,unit:e.unit})))}
      ۲. تاریخچه حواله‌های خروج اخیر (۳۰ روز گذشته): ${JSON.stringify(c.filter(e=>e.type==="OUT").map(e=>({date:e.date,items:e.items})))}
      
      وظیفه اصلی:
      - محاسبه نرخ میانگین خروج روزانه هر کالا.
      - پیش‌بینی دقیق اینکه کدام کالاها با روند فعلی تا ۱۰ روز آینده به موجودی صفر می‌رسند.
      - ارائه هشدار (AI Stock Alert) برای کالاهای در خطر.
      
      فرمت پاسخ:
      - ۳ پاراگراف کوتاه و بسیار حرفه‌ای.
      - در انتهای پاسخ، لیست کالاهای بحرانی را با علامت ⚠️ و تخمین روز باقی‌مانده بنویس.
      - لحن: قاطع و مدیریتی.
    `;return await $(s,[{parts:[{text:n}]}])}catch(n){console.warn("AI Analysis Fallback triggered:",n==null?void 0:n.message);const e=t.filter(a=>a.stock<=(a.minStock||5)),o=t.filter(a=>a.stock===0);let r=`📊 **گزارش تحلیلی انبار (محاسبه‌گر آفلاین سیستم):**

`;return r+=`در حال حاضر از مجموع ${t.length} عنوان کالا، ${e.length} کالا به نقطه سفارش رسیده‌اند و ${o.length} کالا موجودی صفر دارند.

`,e.length>0||o.length>0?(r+=`⚠️ **کالاهای نیازمند اقدام فوری:**
`,e.forEach(a=>{r+=`• ⚠️ **${a.name}**: موجودی فعلی ${a.stock} ${a.unit||"عدد"} (حداقل انبار: ${a.minStock||5})
`})):r+=`✅ وضعیت موجودی تمامی کالاها در سطح مطلوب ارزیابی می‌شود.
`,r}},k=async t=>{const c=`financial_analysis_${t.totalSales}_${t.totalPurchase}_${t.totalReceivables}`;try{const s=`تحلیل مالی کوتاه و ۳ توصیه کاربردی برای کسب‌وکار بر اساس: فروش ${t.totalSales}، خرید ${t.totalPurchase}، مطالبات ${t.totalReceivables}.`;return await $(c,[{parts:[{text:s}]}])}catch{const n=t.totalSales-t.totalPurchase,e=t.totalSales>0?Math.round(t.totalReceivables/t.totalSales*100):0;let o=`💡 **تحلیل هوشمند مالی (موتور آفلاین دسکتاپ):**

`;return o+=`۱. **سودآوری ناخالص**: سود ناخالص محاسبه‌شده شما برابر با ${n.toLocaleString("fa-IR")} ریال است.
`,o+=`۲. **نسبت مطالبات**: حدود ${e}% از فروش کل شما در قالب مطالبات است. ${e>30?"⚠️ پیشنهاد می‌شود وصول مطالبات معوق سرعت داده شود.":"✅ وضعیت نقدشوندگی مطلوب است."}
`,o+="۳. **توصیه عملیاتی**: جهت بهینه‌سازی جریان نقدینگی، برنامه‌ریزی پرداخت چک‌های سررسید نزدیک در اولویت قرار گیرد.",o}};export{k as a,d as b};
