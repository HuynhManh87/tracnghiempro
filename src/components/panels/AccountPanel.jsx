import { accountHtml } from '../../legacy/fragments';

export default function AccountPanel() {
  return <section id="panel-account" className="panel" dangerouslySetInnerHTML={{ __html: accountHtml }} />;
}
