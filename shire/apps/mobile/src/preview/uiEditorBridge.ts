export type HostPreviewUiState = {
  tokens: Record<string, string>;
  componentOverrides: Record<string, Record<string, string>>;
  mode: 'view' | 'edit';
};

function sendPreviewMessage(message: Record<string, unknown>) {
  const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
  if (window.parent !== window) window.parent.postMessage(message, parentOrigin);
  const nativeBridge = (window as typeof window & { ReactNativeWebView?: { postMessage: (value: string) => void } }).ReactNativeWebView;
  nativeBridge?.postMessage(JSON.stringify(message));
}

function normalizedColor(value: string): string {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.appendChild(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  return normalized;
}

function textColorElement(target: HTMLElement): HTMLElement {
  return Array.from(target.querySelectorAll<HTMLElement>('*')).find((element) =>
    Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())),
  ) ?? target;
}

export function installHostPreviewEditorBridge(onState: (state: HostPreviewUiState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let state: HostPreviewUiState = { tokens: {}, componentOverrides: {}, mode: 'view' };
  let highlighted: HTMLElement | null = null;

  const receive = (event: MessageEvent) => {
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : null;
    if (parentOrigin && event.origin !== parentOrigin) return;
    if (event.data?.type !== 'shire-ui-preview-state' || event.data.service !== 'host' || !event.data.tokens) return;
    state = {
      tokens: event.data.tokens,
      componentOverrides: event.data.componentOverrides ?? {},
      mode: event.data.mode ?? 'view',
    };
    onState(state);
    if (state.mode === 'view' && highlighted) {
      highlighted.style.outline = '';
      highlighted = null;
    }
  };

  const hover = (event: MouseEvent) => {
    if (state.mode !== 'edit') return;
    const rawTarget = event.target as HTMLElement | null;
    const target = rawTarget?.closest<HTMLElement>('[data-testid^="shire-ui-"],[id^="shire-ui-"]') ?? rawTarget;
    if (!target || target === highlighted) return;
    if (highlighted) highlighted.style.outline = '';
    highlighted = target;
    highlighted.style.outline = '2px solid #156CC2';
    highlighted.style.outlineOffset = '-2px';
  };

  const select = (event: MouseEvent) => {
    if (state.mode !== 'edit') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const rawTarget = event.target as HTMLElement;
    const registeredTarget = rawTarget.closest<HTMLElement>('[data-testid^="shire-ui-"],[id^="shire-ui-"]');
    const target = registeredTarget ?? rawTarget.closest<HTMLElement>('button,[role="button"],a') ?? rawTarget;
    const registeredId = registeredTarget?.id?.replace(/^shire-ui-/, '') || registeredTarget?.dataset.testid?.replace(/^shire-ui-/, '');
    const label = target.getAttribute('aria-label') || target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) || target.tagName.toLowerCase();
    const componentId = registeredId || `host.unregistered.${target.tagName.toLowerCase()}.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'component'}`;
    const computed = getComputedStyle(target);
    const textComputed = getComputedStyle(textColorElement(target));
    const editableProperties: Array<[string, string, string]> = [
      ['backgroundColor', 'Background', computed.backgroundColor],
      ['color', 'Text', textComputed.color],
      ['borderColor', 'Border', computed.borderColor],
    ];
    const properties = editableProperties.map(([property, labelText, value]) => ({
      property,
      label: labelText,
      value,
      tokenKey: Object.entries(state.tokens).find(([, tokenValue]) => normalizedColor(tokenValue) === normalizedColor(value))?.[0] ?? null,
    }));
    sendPreviewMessage({ type: 'shire-ui-preview-component-selected', service: 'host', component: { componentId, label, registered: Boolean(registeredId), properties } });
  };

  window.addEventListener('message', receive);
  document.addEventListener('mouseover', hover, true);
  document.addEventListener('click', select, true);
  sendPreviewMessage({ type: 'shire-ui-preview-ready', service: 'host' });
  return () => {
    window.removeEventListener('message', receive);
    document.removeEventListener('mouseover', hover, true);
    document.removeEventListener('click', select, true);
  };
}
