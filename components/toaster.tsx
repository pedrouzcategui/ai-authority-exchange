"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        style: {
          borderRadius: "18px",
        },
      }}
    />
  );
}
