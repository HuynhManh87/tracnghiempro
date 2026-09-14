import { historyHtml } from '../../legacy/fragments';

export default function HistoryPanel() {
  return <section id="panel-history" className="panel" dangerouslySetInnerHTML={{ __html: historyHtml }} />;
}
