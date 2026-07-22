/* eslint-env browser */
// Detects a pasted or typed Projecto task-share link (any URL containing
// "/api/web/share/") and renders it as a rich card — icon, title, short
// description — instead of plain text/link. The card's data is fetched
// natively (see RichEditor.tsx's onMessage + projectoLinkResolver.ts): a
// WebView-side fetch would be subject to browser CORS, which the share page
// does not grant, while RN's own fetch is not.
import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core';

const SHARE_URL_RE = /(https?:\/\/[^\s<>"']*\/api\/web\/share\/[^\s<>"']*)/g;
const SHARE_URL_INPUT_RE = /(https?:\/\/[^\s<>"']*\/api\/web\/share\/[^\s<>"']*)\s$/;

let idCounter = 0;
const genId = () => `pl-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function postMessage(message) {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
}

let cssInjected = false;
function injectCardCSS() {
  if (cssInjected || document.getElementById('pl-card-styles')) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'pl-card-styles';
  style.textContent = `
    .pl-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border: 1px solid #dadada;
      border-radius: 12px;
      padding: 12px;
      margin: 8px 0;
      background: #ffffff;
      cursor: pointer;
    }
    .pl-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      background: #f0f0f0;
    }
    .pl-card-icon--skeleton {
      background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
      background-size: 200% 100%;
      animation: pl-shimmer 1.2s infinite;
    }
    @keyframes pl-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .pl-card-body { flex: 1; min-width: 0; }
    .pl-card-title {
      font-weight: 600;
      font-size: 15px;
      color: #202124;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pl-card--loading .pl-card-title { color: #9aa0a6; }
    .pl-card-description {
      font-size: 13px;
      color: #5f6368;
      margin-top: 4px;
    }
    .pl-card--error { border-style: dashed; }
    .pl-card-fallback-link {
      color: #0085e2;
      word-break: break-all;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

function paintCard(dom, attrs) {
  dom.className = `pl-card pl-card--${attrs.status || 'loading'}`;
  dom.setAttribute('data-projecto-id', attrs.id || '');
  dom.innerHTML = '';

  if (attrs.status === 'error') {
    const link = document.createElement('a');
    link.className = 'pl-card-fallback-link';
    link.href = attrs.href;
    link.textContent = attrs.href;
    dom.appendChild(link);
    return;
  }

  if (attrs.icon) {
    const icon = document.createElement('img');
    icon.className = 'pl-card-icon';
    icon.src = attrs.icon;
    dom.appendChild(icon);
  } else {
    const skeleton = document.createElement('div');
    skeleton.className = 'pl-card-icon pl-card-icon--skeleton';
    dom.appendChild(skeleton);
  }

  const body = document.createElement('div');
  body.className = 'pl-card-body';

  const title = document.createElement('div');
  title.className = 'pl-card-title';
  title.textContent = attrs.title || 'Загрузка…';
  body.appendChild(title);

  if (attrs.description) {
    const desc = document.createElement('div');
    desc.className = 'pl-card-description';
    desc.textContent = attrs.description;
    body.appendChild(desc);
  }

  dom.appendChild(body);
}

export const ProjectoLink = Node.create({
  name: 'projectoLink',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  // Higher than Link's default (100, see @10play/tentap-editor's LinkBridge)
  // so this node's rule claims the URL text before Link can autolink it.
  priority: 1000,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-id'),
        renderHTML: (attrs) => ({ 'data-projecto-id': attrs.id }),
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-href'),
        renderHTML: (attrs) => ({ 'data-projecto-href': attrs.href }),
      },
      status: {
        default: 'loading',
        parseHTML: (el) => el.getAttribute('data-projecto-status') || 'loading',
        renderHTML: (attrs) => ({ 'data-projecto-status': attrs.status }),
      },
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-title'),
        renderHTML: (attrs) => (attrs.title ? { 'data-projecto-title': attrs.title } : {}),
      },
      icon: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-icon'),
        renderHTML: (attrs) => (attrs.icon ? { 'data-projecto-icon': attrs.icon } : {}),
      },
      description: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-description'),
        renderHTML: (attrs) =>
          attrs.description ? { 'data-projecto-description': attrs.description } : {},
      },
      taskUrl: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-projecto-task-url'),
        renderHTML: (attrs) =>
          attrs.taskUrl ? { 'data-projecto-task-url': attrs.taskUrl } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="projecto-link"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'projecto-link' }),
      [
        'a',
        { href: HTMLAttributes['data-projecto-task-url'] || HTMLAttributes['data-projecto-href'] },
        HTMLAttributes['data-projecto-title'] || HTMLAttributes['data-projecto-href'],
      ],
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: SHARE_URL_RE,
        type: this.type,
        getAttributes: (match) => ({ id: genId(), href: match[0], status: 'loading' }),
      }),
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: SHARE_URL_INPUT_RE,
        type: this.type,
        getAttributes: (match) => ({ id: genId(), href: match[1], status: 'loading' }),
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      injectCardCSS();

      let currentNode = node;
      const dom = document.createElement('div');
      dom.contentEditable = 'false';
      paintCard(dom, currentNode.attrs);

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        postMessage({
          type: 'projectoLinkPress',
          payload: { taskUrl: currentNode.attrs.taskUrl || currentNode.attrs.href },
        });
      });

      // Only fire the resolve round-trip for a genuinely fresh node — never
      // for one rehydrated from persisted HTML that already has a title.
      if (currentNode.attrs.status === 'loading' && !currentNode.attrs.title) {
        postMessage({
          type: 'projectoLinkResolve',
          payload: { id: currentNode.attrs.id, url: currentNode.attrs.href },
        });
      }

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'projectoLink') return false;
          currentNode = updatedNode;
          paintCard(dom, currentNode.attrs);
          return true;
        },
      };
    };
  },
});
