import type { Metadata } from 'next';
import BoardsConfigurator from '@/components/BoardsConfigurator';

export const metadata: Metadata = {
    title: 'Boards · 4CHMG2',
};

export default function BoardsPage() {
    return <BoardsConfigurator />;
}
