import { ClipboardList } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', description = 'When you add information, it will appear here.' }) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={22} /></div><h3>{title}</h3><p>{description}</p></div>;
}
