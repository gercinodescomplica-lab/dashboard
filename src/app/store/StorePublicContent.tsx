'use client';

import { useState, useEffect } from 'react';
import { getStoreProducts } from '@/app/pipeline/actions';
import PipelineStoreView from '@/components/dashboard/PipelineStoreView';

export function StorePublicContent() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStoreProducts().then(data => {
            setProducts(data);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 p-4">
            <PipelineStoreView PRODUCTS={products} />
        </div>
    );
}
