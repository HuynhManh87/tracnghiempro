import { printHtml } from '../../legacy/fragments';

export default function PrintPanel() {
  return <section id="panel-print" className="panel" dangerouslySetInnerHTML={{ __html: printHtml }} />;
}
