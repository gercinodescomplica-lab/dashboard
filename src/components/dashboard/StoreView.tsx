"use client";

export default function StoreView() {
    return (
        <div className="w-full h-full flex flex-col bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md relative">
            <iframe
                src="https://lookerstudio.google.com/embed/reporting/c302eff2-4dbd-4a8c-95cc-9c23a60ebbb8/page/xgKIF"
                className="w-full h-full border-0 absolute inset-0"
                style={{ border: 0 }}
                allowFullScreen
            />
        </div>
    );
}

