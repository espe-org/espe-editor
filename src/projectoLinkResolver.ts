export interface ProjectoLinkData {
	title: string;
	icon: string | null;
	description: string;
	taskUrl: string;
}

const TITLE_RE = /<title>([\s\S]*?)<\/title>/i;
// The `.image` div holds the per-notification icon; `.logo` is site-wide
// branding (same on every share page) and must not be confused with it.
const IMAGE_DIV_RE = /<div\s+class="image"[^>]*>[\s\S]*?<img[^>]*\ssrc="([^"]+)"/i;
const LIST_RE = /<ul>([\s\S]*?)<\/ul>/i;
const LIST_ITEM_RE = /<li>([\s\S]*?)<\/li>/gi;
const BOTTOM_LINK_RE = /<div\s+class="bottom_link"[^>]*>\s*<a[^>]*\shref="([^"]+)"/i;

function stripTags(html: string): string {
	return html
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Fetches a Projecto task-share page and scrapes its (Open-Graph-less, static)
 * markup for card data. Runs on the RN side rather than inside the editor's
 * WebView because the share page sends no CORS headers — a fetch from the
 * WebView's own JS context would be rejected, while RN's fetch is not subject
 * to browser CORS at all.
 */
export async function resolveProjectoLink(url: string): Promise<ProjectoLinkData | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const html = await res.text();

		const titleMatch = html.match(TITLE_RE);
		const title = titleMatch ? stripTags(titleMatch[1]) : "";
		if (!title) return null;

		const iconMatch = html.match(IMAGE_DIV_RE);
		const icon = iconMatch ? iconMatch[1] : null;

		const listMatch = html.match(LIST_RE);
		let description = "";
		if (listMatch) {
			const items: string[] = [];
			LIST_ITEM_RE.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = LIST_ITEM_RE.exec(listMatch[1])) !== null) {
				items.push(stripTags(m[1]));
			}
			description = items.join(" · ");
		}

		const bottomMatch = html.match(BOTTOM_LINK_RE);
		const taskUrl = bottomMatch ? bottomMatch[1] : url;

		return { title, icon, description, taskUrl };
	} catch {
		return null;
	}
}

/**
 * Builds a script for editor.injectJS() that locates a `projectoLink` node by
 * its `id` attr inside the WebView's live ProseMirror doc and patches its
 * attrs — the return path for a resolve request, since injectJS itself is
 * fire-and-forget with no way to return a value to RN.
 */
export function buildPatchProjectoLinkScript(id: string, patch: Record<string, unknown>): string {
	return `
    (function () {
      var editor = window.__editor;
      if (!editor || !editor.state) return true;
      var targetPos = null;
      editor.state.doc.descendants(function (node, pos) {
        if (targetPos !== null) return false;
        if (node.type.name === 'projectoLink' && node.attrs.id === ${JSON.stringify(id)}) {
          targetPos = pos;
          return false;
        }
        return true;
      });
      if (targetPos === null) return true;
      var node = editor.state.doc.nodeAt(targetPos);
      if (!node) return true;
      var tr = editor.state.tr.setNodeMarkup(targetPos, undefined, Object.assign({}, node.attrs, ${JSON.stringify(patch)}));
      editor.view.dispatch(tr);
      true;
    })();
  `;
}
