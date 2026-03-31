/**
 * HTML ->纯文本/Markdown 轻量级极速清洗管道
 * 
 * 绝不引入臃肿的 cheerio，完全依靠 JS Native Regex 替换引擎。
 * 它能够将带有海量 style、广告和多余容器的页面一比一无损剥包为供大模型阅读的语料。
 */
export class HtmlToMarkdownConverter {
  public static convert(html: string): string {
    let result = html;

    // 1. 移除 script/style/nav/footer/noscript/svg 等非主题内容容器块
    result = result.replace(
      /<(script|style|nav|footer|header|noscript|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    );

    // 2. 移除 <head> 和其中各种 mata
    result = result.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    // 3. 标题标签 -> Markdown
    for (let i = 6; i >= 1; i--) {
      const regex = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi');
      result = result.replace(regex, (_, content) => `\n${'#'.repeat(i)} ${this.stripTags(content)}\n`);
    }

    // 4. 段落和换行处理
    result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `\n${this.stripTags(content)}\n`);
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<div[^>]*>/gi, '\n');

    // 5. 粗体和斜体
    result = result.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, content) => `**${content}**`);
    result = result.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, content) => `*${content}*`);

    // 6. 链接提取
    result = result.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
      const cleanText = this.stripTags(text).trim();
      return cleanText ? `[${cleanText}](${url})` : cleanText;
    });

    // 7. 图片提取
    result = result.replace(/<img[^>]+src="([^"]*)"(?:[^>]*alt="([^"]*)")?[^>]*\/?>/gi, (_, src, alt) => {
      return `![${alt || ''}](${src})`;
    });

    // 8. 列表提取
    result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${this.stripTags(content)}\n`);

    // 9. 代码块
    result = result.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, content) => `\n\`\`\`\n${this.decodeEntities(content)}\n\`\`\`\n`);
    result = result.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, content) => `\`${content}\``);

    // 10. 表格简易剥离 
    result = result.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, (_, content) => ` | ${this.stripTags(content)}`);
    result = result.replace(/<\/tr>/gi, ' |\n');

    // 11. 区块引用
    result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const text = this.stripTags(content);
      return text.split('\n').map(l => `> ${l.trim()}`).join('\n');
    });

    // 12. 水平线
    result = result.replace(/<hr\s*\/?>/gi, '\n---\n');

    // 13. 清除剩余冗余标签
    result = this.stripTags(result);

    // 14. 还原 HTML Entity 表意词转义
    result = this.decodeEntities(result);

    // 15. 合并连续多个空行为双空行
    result = result.replace(/\n{3,}/g, '\n\n');

    // 16. 行尾去空整理
    return result.split('\n').map(l => l.trimEnd()).join('\n').trim();
  }

  private static stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  private static decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '…')
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .replace(/&bull;/g, '•')
      .replace(/&copy;/g, '©')
      .replace(/&reg;/g, '®')
      .replace(/&trade;/g, '™')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }
}
