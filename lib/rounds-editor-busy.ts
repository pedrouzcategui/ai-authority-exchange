let roundEditorBusy = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getRoundEditorBusySnapshot() {
  return roundEditorBusy;
}

export function setRoundEditorBusy(nextValue: boolean) {
  if (roundEditorBusy === nextValue) {
    return;
  }

  roundEditorBusy = nextValue;
  notifyListeners();
}

export function subscribeToRoundEditorBusy(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
