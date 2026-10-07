let shouldReopenDrawer = false;

export function requestDrawerReopen() {
  console.log('[drawerSignal] flag SET to true');
  shouldReopenDrawer = true;
}

export function consumeDrawerReopen() {
  const value = shouldReopenDrawer;
  console.log('[drawerSignal] flag CONSUMED, was:', value);
  shouldReopenDrawer = false;
  return value;
}