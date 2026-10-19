import React from 'react';

// Intentionally tiny placeholder used only in desktop, Android and preview builds.
// The real license manager is imported only by the mother web portal build.
const LicensemanagerUnavailable: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-950 text-slate-200" dir="rtl">
        این بخش فقط در پرتال مادرِ وب در دسترس است.
    </div>
);

export default LicensemanagerUnavailable;
