import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { Brain, Send, Sparkles, AlertCircle } from 'lucide-react';

export default function AIFinancialAssistant() {
  const { aiInsights, addAIInsight } = useFinancialStore();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    // شبیهسازی پاسخ AI
    setTimeout(() => {
      setResponse(`بر اساس تحلیل دادههای مالی شما:
      
• جریان نقدی شما در ماه گذشته 15% کاهش یافته است
• توصیه میشود هزینههای عملیاتی را بررسی کنید
• پیشبینی میشود درآمد ماه آینده 8% افزایش یابد
• نسبت نقدینگی شما در وضعیت مطلوبی قرار دارد`);
      setLoading(false);
    }, 2000);
  };

  const priorityColors = {
    LOW: 'bg-blue-100 text-blue-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800'
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-teal-400" />
        <h1 className="text-2xl font-bold">دستیار مالی و تحلیلی (دپارتمان IT اشک قلم)</h1>
      </div>

      {/* چت و تحلیل دپارتمان IT اشک قلم */}
      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-100">
          <Sparkles className="w-5 h-5 text-teal-400" />
          استعلام وضعیت مالی از دپارتمان IT اشک قلم
        </h2>
        
        <div className="space-y-4">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="سوال خود را بپرسید... مثال: وضعیت مالی من چطور است؟"
            className="w-full px-4 py-3 border rounded-lg resize-none h-24"
          />
          
          <button
            onClick={handleAsk}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                در حال تحلیل...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                ارسال
              </>
            )}
          </button>

          {response && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-purple-600 mt-1" />
                <div className="flex-1 whitespace-pre-line">{response}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* هشدارها و توصیه‌های دپارتمان IT اشک قلم */}
      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-slate-100">هشدارها و توصیه‌های دپارتمان IT اشک قلم</h2>
        
        <div className="space-y-3">
          {aiInsights.map(insight => (
            <div key={insight.id} className="border border-white/10 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-800/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-200">{insight.title}</h3>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${priorityColors[insight.priority]}`}>
                  {insight.priority === 'CRITICAL' ? 'بحرانی' :
                   insight.priority === 'HIGH' ? 'مهم' :
                   insight.priority === 'MEDIUM' ? 'متوسط' : 'کم'}
                </span>
              </div>
              
              <p className="text-sm text-slate-300 mb-3">{insight.description}</p>
              
              {insight.recommendations && insight.recommendations.length > 0 && (
                <div className="bg-purple-50 rounded p-3">
                  <div className="text-xs font-bold text-purple-900 mb-2">توصیهها:</div>
                  <ul className="text-xs space-y-1">
                    {insight.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-600">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="text-xs text-slate-500 mt-2">{insight.date}</div>
            </div>
          ))}

          {aiInsights.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>هنوز هشدار یا توصیهای وجود ندارد</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
