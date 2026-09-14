import { templatesHtml } from '../../legacy/fragments';

export default function TemplatesPanel() {
  return <section id="panel-templates" className="panel active" dangerouslySetInnerHTML={{ __html: templatesHtml }} />;
}
