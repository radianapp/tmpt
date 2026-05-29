// shared/app-bridge.js - Cross-app communication & URL context passing for TMPT

export function openAppWithContext(appPath, docId, contextName = '', additionalParams = {}) {
  const url = new URL(appPath, location.origin);
  if (docId) url.searchParams.set('id', docId);
  if (contextName) url.searchParams.set('context', contextName);
  Object.entries(additionalParams).forEach(([key, val]) => {
    url.searchParams.set(key, val);
  });
  window.location.href = url.toString();
}

export function getAppBridgeContext() {
  const params = new URLSearchParams(location.search);
  return {
    id: params.get('id'),
    context: params.get('context'),
    getParam: (name) => params.get(name),
    params: params
  };
}
