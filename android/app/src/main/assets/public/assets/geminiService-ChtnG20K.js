import{bc as h,bd as f}from"./index-CM_S273b.js";const y="ai_responses_cache",m=()=>"secure_api_token_change_this",p=async(e,i,n)=>{var s,a,g,d,u;try{const c=await h.get(y,e);if(c&&Date.now()-c.timestamp<1800*1e3)return console.log(`🤖 استفاده از پاسخ کش‌شده هوش مصنوعی برای کلید: ${e}`),c.response}catch{}if(typeof navigator<"u"&&!navigator.onLine)throw new Error("OFFLINE_MODE");const o={contents:i};n&&(o.generationConfig={responseMimeType:"application/json",responseSchema:n});const t=new AbortController,r=setTimeout(()=>t.abort(),15e3);try{const c=await fetch(`${f.BASE_URL}/gemini-api.php`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:m()},body:JSON.stringify(o),signal:t.signal});if(!c.ok)throw new Error(`Gemini API Error ${c.status}`);const l=((u=(d=(g=(a=(s=(await c.json()).candidates)==null?void 0:s[0])==null?void 0:a.content)==null?void 0:g.parts)==null?void 0:d[0])==null?void 0:u.text)||"";return l&&h.save(y,{id:e,response:l,timestamp:Date.now()}).catch(()=>{}),l}finally{clearTimeout(r)}},w=async(e,i)=>{const n=`stock_analysis_${e.length}_${i.length}`;try{const o=`
      به عنوان یک تحلیلگر انبار هوشمند (AI Inventory Auditor)، داده‌های زیر را به دقت بررسی کن:
      ۱. لیست کالاها و موجودی فعلی: ${JSON.stringify(e.map(t=>({name:t.name,stock:t.stock,unit:t.unit})))}
      ۲. تاریخچه حواله‌های خروج اخیر (۳۰ روز گذشته): ${JSON.stringify(i.filter(t=>t.type==="OUT").map(t=>({date:t.date,items:t.items})))}
      
      وظیفه اصلی:
      - محاسبه نرخ میانگین خروج روزانه هر کالا.
      - پیش‌بینی دقیق اینکه کدام کالاها با روند فعلی تا ۱۰ روز آینده به موجودی صفر می‌رسند.
      - ارائه هشدار (AI Stock Alert) برای کالاهای در خطر.
      
      فرمت پاسخ:
      - ۳ پاراگراف کوتاه و بسیار حرفه‌ای.
      - در انتهای پاسخ، لیست کالاهای بحرانی را با علامت ⚠️ و تخمین روز باقی‌مانده بنویس.
      - لحن: قاطع و مدیریتی.
    `;return await p(n,[{parts:[{text:o}]}])}catch(o){console.warn("AI Analysis Fallback triggered:",o==null?void 0:o.message);const t=e.filter(a=>a.stock<=(a.minStock||5)),r=e.filter(a=>a.stock===0);let s=`📊 **گزارش تحلیلی انبار (محاسبه‌گر آفلاین سیستم):**

`;return s+=`در حال حاضر از مجموع ${e.length} عنوان کالا، ${t.length} کالا به نقطه سفارش رسیده‌اند و ${r.length} کالا موجودی صفر دارند.

`,t.length>0||r.length>0?(s+=`⚠️ **کالاهای نیازمند اقدام فوری:**
`,t.forEach(a=>{s+=`• ⚠️ **${a.name}**: موجودی فعلی ${a.stock} ${a.unit||"عدد"} (حداقل انبار: ${a.minStock||5})
`})):s+=`✅ وضعیت موجودی تمامی کالاها در سطح مطلوب ارزیابی می‌شود.
`,s}},_=async e=>{const i=`financial_analysis_${e.totalSales}_${e.totalPurchase}_${e.totalReceivables}`;try{const n=`تحلیل مالی کوتاه و ۳ توصیه کاربردی برای کسب‌وکار بر اساس: فروش ${e.totalSales}، خرید ${e.totalPurchase}، مطالبات ${e.totalReceivables}.`;return await p(i,[{parts:[{text:n}]}])}catch{const o=e.totalSales-e.totalPurchase,t=e.totalSales>0?Math.round(e.totalReceivables/e.totalSales*100):0;let r=`💡 **تحلیل هوشمند مالی (موتور آفلاین دسکتاپ):**

`;return r+=`۱. **سودآوری ناخالص**: سود ناخالص محاسبه‌شده شما برابر با ${o.toLocaleString("fa-IR")} ریال است.
`,r+=`۲. **نسبت مطالبات**: حدود ${t}% از فروش کل شما در قالب مطالبات است. ${t>30?"⚠️ پیشنهاد می‌شود وصول مطالبات معوق سرعت داده شود.":"✅ وضعیت نقدشوندگی مطلوب است."}
`,r+="۳. **توصیه عملیاتی**: جهت بهینه‌سازی جریان نقدینگی، برنامه‌ریزی پرداخت چک‌های سررسید نزدیک در اولویت قرار گیرد.",r}},A=async(e,i)=>{try{const n=`
      You are an expert software developer specializing in accounting systems.
      Analyze the following code for common accounting software errors, such as:
      - Floating point precision issues with currency
      - Incorrect double-entry ledger logic
      - Faulty state management or missing dependencies
      - Date/Time handling errors
      
      File Name: ${i}
      Code:
      ${e}

      Output a JSON object with:
      - description: A brief explanation of the issue found (if any, else "No issues found").
      - originalCode: The exact code snippet that has the issue (keep indentation).
      - fixedCode: The suggested fixed code snippet.
      
      Output only valid JSON.
    `,o={type:"OBJECT",properties:{description:{type:"STRING"},originalCode:{type:"STRING"},fixedCode:{type:"STRING"}}},t=await p(`code_analysis_${i}_${e.length}`,[{parts:[{text:n}]}],o);return JSON.parse(t||"{}")}catch(n){throw console.error("Code Analysis Error:",n),n}};export{_ as a,w as b,A as c};
