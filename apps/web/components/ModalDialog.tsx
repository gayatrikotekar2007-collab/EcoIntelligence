'use client';

import React, { useEffect, useRef, useId, useCallback } from 'react';

export interface UseModalAccessibilityOptions {
  isOpen: boolean;
  onClose?: () => void;
  titleId?: string;
  descriptionId?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean; // default: true
  closeOnBackdropClick?: boolean; // default: false
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog'; // default: 'dialog'
  isolateBackground?: boolean; // default: true
}

interface ModalStackEntry {
  id: string;
  element: HTMLElement;
  modalRef: React.RefObject<HTMLElement | null>;
  isolateBackground: boolean;
}

export interface ElementOriginalState {
  hadInert: boolean;
  originalAriaHidden: string | null;
}

// Module-level stack for coordinating nested dialogs and preventing focus collision
const activeModalStack: ModalStackEntry[] = [];
const modifiedElements = new Map<HTMLElement, ElementOriginalState>();
let originalBodyOverflow: string | null = null;
let guardsAttached = false;

export function restoreElementIsolation(el: HTMLElement, state: ElementOriginalState): void {
  // 1. Independently restore inert attribute and property
  try {
    if (state.hadInert) {
      el.setAttribute('inert', '');
      if ('inert' in el) {
        try {
          (el as any).inert = true;
        } catch (inertPropErr) {
          console.error('Error setting inert property during restoration:', inertPropErr);
        }
      }
    } else {
      el.removeAttribute('inert');
      if ('inert' in el) {
        try {
          (el as any).inert = false;
        } catch (inertPropErr) {
          console.error('Error clearing inert property during restoration:', inertPropErr);
        }
      }
    }
  } catch (inertErr) {
    console.error('Error restoring inert attribute on element:', inertErr);
  }

  // 2. Independently restore aria-hidden attribute
  try {
    if (state.originalAriaHidden !== null) {
      el.setAttribute('aria-hidden', state.originalAriaHidden);
    } else {
      el.removeAttribute('aria-hidden');
    }
  } catch (ariaErr) {
    console.error('Error restoring aria-hidden attribute on element:', ariaErr);
  }
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return elements.filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (el.hidden || el.style.display === 'none' || el.style.visibility === 'hidden') {
      return false;
    }
    if (
      el.hasAttribute('inert') ||
      (el as any).inert ||
      Boolean(el.closest?.('[inert]')) ||
      Boolean(el.closest?.('[aria-hidden="true"]'))
    ) {
      return false;
    }
    return true;
  });
}

export function getModalBoundaryElement(cardElement: HTMLElement | null): HTMLElement | null {
  if (!cardElement) return null;
  const parent = cardElement.parentElement;
  if (!parent || parent === document.body || parent === document.documentElement) {
    return cardElement;
  }
  if (
    parent.getAttribute('data-modal-backdrop') === 'true' ||
    parent.classList.contains('fixed') ||
    parent.children.length === 1
  ) {
    return parent;
  }
  return cardElement;
}

export function computeElementsToIsolate(target: HTMLElement): Set<HTMLElement> {
  const result = new Set<HTMLElement>();
  if (typeof document === 'undefined' || !document.body.contains(target)) return result;

  // Collect all ancestors of target up to (but excluding) document.body
  const ancestors = new Set<HTMLElement>();
  let curr: HTMLElement | null = target;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    ancestors.add(curr);
    curr = curr.parentElement;
  }

  // Collect all siblings of ancestors along the path to document.body
  curr = target;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const parent: HTMLElement | null = curr.parentElement;
    if (!parent) break;

    for (const child of Array.from(parent.children)) {
      if (child instanceof HTMLElement && !ancestors.has(child)) {
        const tag = child.tagName.toLowerCase();
        if (tag !== 'script' && tag !== 'style' && tag !== 'link') {
          result.add(child);
        }
      }
    }

    curr = parent;
  }

  return result;
}

export function reconcileModalIsolation(): void {
  if (typeof document === 'undefined') return;

  // Find topmost modal entry that has isolateBackground = true
  let topEntry: ModalStackEntry | null = null;
  try {
    for (let i = activeModalStack.length - 1; i >= 0; i--) {
      if (activeModalStack[i]?.isolateBackground) {
        topEntry = activeModalStack[i];
        break;
      }
    }
  } catch (err) {
    console.error('Error finding topmost modal entry:', err);
  }

  const activeCard = topEntry ? (topEntry.modalRef.current || topEntry.element) : null;
  const activeBoundary =
    activeCard && typeof document !== 'undefined' && document.body.contains(activeCard)
      ? getModalBoundaryElement(activeCard)
      : null;

  if (!activeBoundary) {
    // Restore all modified elements independently
    for (const [el, state] of Array.from(modifiedElements.entries())) {
      try {
        restoreElementIsolation(el, state);
      } catch (err) {
        console.error('Error restoring isolated element:', err);
      } finally {
        modifiedElements.delete(el);
      }
    }
    modifiedElements.clear();
    return;
  }

  let elementsToIsolate = new Set<HTMLElement>();
  try {
    elementsToIsolate = computeElementsToIsolate(activeBoundary);
  } catch (err) {
    console.error('Error computing elements to isolate:', err);
  }

  // 1. Remove isolation from elements no longer needing it
  for (const [el, state] of Array.from(modifiedElements.entries())) {
    if (!elementsToIsolate.has(el)) {
      try {
        restoreElementIsolation(el, state);
      } catch (err) {
        console.error('Error removing element isolation:', err);
      } finally {
        modifiedElements.delete(el);
      }
    }
  }

  // 2. Apply isolation to newly isolated elements
  for (const el of Array.from(elementsToIsolate)) {
    if (!modifiedElements.has(el)) {
      try {
        modifiedElements.set(el, {
          hadInert: el.hasAttribute('inert') || Boolean((el as any).inert),
          originalAriaHidden: el.getAttribute('aria-hidden'),
        });
      } catch (err) {
        console.error('Error recording element original state:', err);
      }

      try {
        el.setAttribute('inert', '');
        if ('inert' in el) {
          try {
            (el as any).inert = true;
          } catch (propErr) {
            console.error('Error setting inert property on element:', propErr);
          }
        }
      } catch (inertErr) {
        console.error('Error applying inert attribute to element:', inertErr);
      }

      try {
        el.setAttribute('aria-hidden', 'true');
      } catch (ariaErr) {
        console.error('Error applying aria-hidden attribute to element:', ariaErr);
      }
    }
  }
}

function handlePointerCapture(e: MouseEvent | PointerEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (
    target.hasAttribute('inert') ||
    Boolean(target.closest?.('[inert]')) ||
    target.getAttribute('aria-hidden') === 'true' ||
    Boolean(target.closest?.('[aria-hidden="true"]'))
  ) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
}

function handleFocusIn(e: FocusEvent) {
  if (activeModalStack.length === 0 || typeof document === 'undefined') return;
  const topEntry = activeModalStack[activeModalStack.length - 1];
  const container = topEntry.modalRef.current || topEntry.element;
  if (!container) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  if (!container.contains(target)) {
    if (
      target.hasAttribute('inert') ||
      Boolean(target.closest?.('[inert]')) ||
      target.getAttribute('aria-hidden') === 'true' ||
      Boolean(target.closest?.('[aria-hidden="true"]'))
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }
  }
}

function attachGlobalGuards() {
  if (guardsAttached || typeof document === 'undefined') return;
  try {
    document.addEventListener('click', handlePointerCapture, true);
  } catch (err) {
    console.error('Error attaching click guard listener:', err);
  }
  try {
    document.addEventListener('pointerdown', handlePointerCapture, true);
  } catch (err) {
    console.error('Error attaching pointerdown guard listener:', err);
  }
  try {
    document.addEventListener('mousedown', handlePointerCapture, true);
  } catch (err) {
    console.error('Error attaching mousedown guard listener:', err);
  }
  try {
    document.addEventListener('focusin', handleFocusIn, true);
  } catch (err) {
    console.error('Error attaching focusin guard listener:', err);
  }
  guardsAttached = true;
}

function detachGlobalGuards() {
  if (!guardsAttached || typeof document === 'undefined') return;
  try {
    try {
      document.removeEventListener('click', handlePointerCapture, true);
    } catch (err) {
      console.error('Error removing click guard listener:', err);
    }
    try {
      document.removeEventListener('pointerdown', handlePointerCapture, true);
    } catch (err) {
      console.error('Error removing pointerdown guard listener:', err);
    }
    try {
      document.removeEventListener('mousedown', handlePointerCapture, true);
    } catch (err) {
      console.error('Error removing mousedown guard listener:', err);
    }
    try {
      document.removeEventListener('focusin', handleFocusIn, true);
    } catch (err) {
      console.error('Error removing focusin guard listener:', err);
    }
  } finally {
    guardsAttached = false;
  }
}

export function __resetModalStackForTesting(): void {
  try {
    activeModalStack.length = 0;
  } catch (err) {
    console.error('Error clearing activeModalStack in test reset:', err);
  }
  try {
    reconcileModalIsolation();
  } catch (err) {
    console.error('Error reconciling isolation in test reset:', err);
  }
  try {
    detachGlobalGuards();
  } catch (err) {
    console.error('Error detaching global guards in test reset:', err);
  }
  try {
    if (typeof document !== 'undefined' && originalBodyOverflow !== null) {
      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = null;
    }
  } catch (err) {
    console.error('Error restoring body overflow in test reset:', err);
  }
}

export function __getActiveModalStackCount(): number {
  return activeModalStack.length;
}

export function __getModifiedElementsCount(): number {
  return modifiedElements.size;
}

export function __isGuardsAttached(): boolean {
  return guardsAttached;
}

export function __getOriginalBodyOverflow(): string | null {
  return originalBodyOverflow;
}

export function useModalAccessibility({
  isOpen,
  onClose,
  titleId,
  descriptionId,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdropClick = false,
  initialFocusRef,
  returnFocusRef,
  role = 'dialog',
  isolateBackground = true,
}: UseModalAccessibilityOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const internalId = useId();
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Keep references to latest callbacks and configurations without re-triggering effect
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const initialFocusRefLocal = useRef(initialFocusRef);
  const returnFocusRefLocal = useRef(returnFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
    initialFocusRefLocal.current = initialFocusRef;
    returnFocusRefLocal.current = returnFocusRef;
  });

  // Manage modal open / close lifecycle
  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined') {
      // Store the active element to restore focus on dismiss
      previousActiveElementRef.current =
        returnFocusRefLocal.current?.current || (document.activeElement as HTMLElement | null);

      // Lock document scroll and attach global guards on opening first modal
      if (activeModalStack.length === 0) {
        originalBodyOverflow = document.body.style.overflow;
        try {
          document.body.style.overflow = 'hidden';
        } catch (err) {
          console.error('Error locking body overflow:', err);
        }
        attachGlobalGuards();
      }

      // Register this modal on the active stack
      const modalElement = modalRef.current || document.body;
      if (!activeModalStack.some((e) => e.id === internalId)) {
        activeModalStack.push({
          id: internalId,
          element: modalElement,
          modalRef,
          isolateBackground,
        });
      }

      reconcileModalIsolation();
    }

    // Move initial focus into dialog
    const focusInitialElement = () => {
      const container = modalRef.current;
      if (!container) return;

      const customInitial = initialFocusRefLocal.current?.current;
      if (customInitial && container.contains(customInitial)) {
        customInitial.focus();
        return;
      }

      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    };

    // Attempt focus immediately (for synchronous test environments)
    focusInitialElement();

    // Also schedule via rAF for deferred/animated child mounts in browser
    let rafId: number | null = null;
    if (typeof window !== 'undefined') {
      rafId = window.requestAnimationFrame(() => {
        focusInitialElement();
        reconcileModalIsolation();
      });
    }

    // Keyboard navigation (Tab trap & Escape dismissal)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only topmost modal in the stack responds to key events
      const isTopModal =
        activeModalStack.length > 0 &&
        activeModalStack[activeModalStack.length - 1].id === internalId;

      if (!isTopModal) return;

      if (e.key === 'Escape') {
        if (closeOnEscapeRef.current && onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const container = modalRef.current;
        if (!container) return;

        const focusables = getFocusableElements(container);
        if (focusables.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];
        const activeElement = document.activeElement;

        if (e.shiftKey) {
          // Shift + Tab: cycle backward
          if (activeElement === firstElement || !container.contains(activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: cycle forward
          if (activeElement === lastElement || !container.contains(activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // 1. Cancel requestAnimationFrame if pending
      if (rafId !== null && typeof window !== 'undefined') {
        try {
          window.cancelAnimationFrame(rafId);
        } catch (err) {
          console.error('Error cancelling animation frame:', err);
        }
      }

      // 2. Remove keydown listener
      try {
        window.removeEventListener('keydown', handleKeyDown);
      } catch (err) {
        console.error('Error removing keydown event listener:', err);
      }

      // 3. Pop from active modal stack
      try {
        const index = activeModalStack.findIndex((entry) => entry.id === internalId);
        if (index !== -1) {
          activeModalStack.splice(index, 1);
        }
      } catch (err) {
        console.error('Error removing modal from active stack:', err);
      }

      // 4. Reconcile background isolation for remaining modals
      try {
        reconcileModalIsolation();
      } catch (err) {
        console.error('Error reconciling modal background isolation:', err);
      }

      // 5. Check if any other modals remain active
      const hasOtherModals = activeModalStack.some((entry) => entry.id !== internalId);

      // 6. Detach global guards when no other modals remain
      if (!hasOtherModals && typeof document !== 'undefined') {
        try {
          detachGlobalGuards();
        } catch (err) {
          console.error('Error detaching global guards:', err);
        }
      }

      // 7. Restore document body overflow when no other modals remain
      if (!hasOtherModals && typeof document !== 'undefined') {
        try {
          if (originalBodyOverflow !== null) {
            document.body.style.overflow = originalBodyOverflow;
            originalBodyOverflow = null;
          }
        } catch (err) {
          console.error('Error restoring body overflow:', err);
        }
      }

      // 8. Restore focus to original triggering control
      try {
        const targetToRestore =
          returnFocusRefLocal.current?.current || previousActiveElementRef.current;
        if (
          targetToRestore &&
          typeof targetToRestore.focus === 'function' &&
          typeof document !== 'undefined' &&
          document.contains(targetToRestore)
        ) {
          const topEntry =
            activeModalStack.length > 0 ? activeModalStack[activeModalStack.length - 1] : null;
          const topElement = topEntry ? (topEntry.modalRef.current || topEntry.element) : null;
          if (
            !topElement ||
            !topElement.contains(document.activeElement) ||
            document.activeElement === document.body
          ) {
            targetToRestore.focus();
          }
        }
      } catch (err) {
        console.error('Error restoring focus:', err);
      }
    };
  }, [isOpen, internalId, isolateBackground]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget && onCloseRef.current) {
        onCloseRef.current();
      }
    },
    [closeOnBackdropClick]
  );

  return {
    modalRef,
    dialogProps: {
      role,
      'aria-modal': true as const,
      'aria-labelledby': titleId,
      'aria-describedby': descriptionId,
      'aria-label': ariaLabel,
      tabIndex: -1,
    },
    handleBackdropClick,
  };
}

export interface ModalDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  titleId?: string;
  descriptionId?: string;
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  isolateBackground?: boolean;
  className?: string; // Backdrop container styling
  contentClassName?: string; // Dialog card styling
  children: React.ReactNode;
  zIndex?: string; // e.g. "z-50", "z-[60]"
}

export function ModalDialog({
  isOpen,
  onClose,
  titleId,
  descriptionId,
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdropClick = false,
  initialFocusRef,
  returnFocusRef,
  role = 'dialog',
  isolateBackground = true,
  className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto',
  contentClassName = 'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl my-8',
  children,
  zIndex,
}: ModalDialogProps) {
  const { modalRef, dialogProps, handleBackdropClick } = useModalAccessibility({
    isOpen,
    onClose,
    titleId,
    descriptionId,
    ariaLabel,
    closeOnEscape,
    closeOnBackdropClick,
    initialFocusRef,
    returnFocusRef,
    role,
    isolateBackground,
  });

  if (!isOpen) return null;

  const backdropClass = zIndex ? className.replace(/\bz-\d+\b|\bz-\[\w+\]/g, zIndex) : className;

  return (
    <div
      data-modal-backdrop="true"
      className={backdropClass}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        {...dialogProps}
        className={contentClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
