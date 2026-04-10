import { KeyGatePipeline } from './KeyGatePipeline';
import { PipelineAdmin } from './PipelineAdmin';

export const metadata = {
  title: 'Pipeline Store - Admin',
};

export default function PipelinePage() {
    return (
        <div className="min-h-screen bg-zinc-950">
            <KeyGatePipeline>
                <PipelineAdmin />
            </KeyGatePipeline>
        </div>
    );
}
