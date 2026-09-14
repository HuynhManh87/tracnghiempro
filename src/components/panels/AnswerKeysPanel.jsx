import { keyHtml } from '../../legacy/fragments';

export default function AnswerKeysPanel() {
  return <section id="panel-key" className="panel" dangerouslySetInnerHTML={{ __html: keyHtml }} />;
}
