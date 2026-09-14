import { adminHtml } from '../../legacy/fragments';

export default function AdminPanel() {
  return <section id="panel-admin" className="panel" dangerouslySetInnerHTML={{ __html: adminHtml }} />;
}
