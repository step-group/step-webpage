import { marked } from 'marked';
import styles from './MarkdownBody.module.css';

marked.setOptions({ breaks: true, gfm: true });

export default function MarkdownBody({ content }) {
  if (!content?.trim()) {
    return <p className={styles.empty}>Sin contenido</p>;
  }
  return (
    <div
      className={styles.body}
      dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
    />
  );
}
