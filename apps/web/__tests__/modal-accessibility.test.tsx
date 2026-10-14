import React, { useState, useRef, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ModalDialog,
  useModalAccessibility,
  getFocusableElements,
  restoreElementIsolation,
  __resetModalStackForTesting,
  __getActiveModalStackCount,
  __getModifiedElementsCount,
  __isGuardsAttached,
  __getOriginalBodyOverflow,
} from '../components/ModalDialog';

/**
 * ModalDialog Accessibility Suite (Wave 3B)
 *
 * NOTE ON TESTING LIMITATIONS:
 * Automated tests in JSDOM verify DOM tree manipulation, attribute states (inert, aria-modal,
 * aria-hidden, role), keyboard focus trapping (Tab, Shift+Tab), Escape key coordination,
 * and pointer/focus event suppression. However, JSDOM does not execute browser layout or
 * interface with assistive-technology APIs. Therefore, JSDOM tests verify DOM accessibility
 * compliance but do not fully substitute for live screen-reader verification (e.g. NVDA,
 * VoiceOver, or JAWS).
 */
describe('ModalDialog Accessibility Suite (Wave 3B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
    __resetModalStackForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetModalStackForTesting();
    document.body.style.overflow = '';
  });

  describe('Semantics and ARIA Attributes', () => {
    it('renders with role="dialog" and aria-modal="true" when open', () => {
      render(
        <ModalDialog isOpen={true} titleId="dialog-title">
          <h2 id="dialog-title">Test Modal Title</h2>
          <button type="button">Action</button>
        </ModalDialog>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    });

    it('supports role="alertdialog" and aria-describedby for critical alerts', () => {
      render(
        <ModalDialog
          isOpen={true}
          role="alertdialog"
          titleId="alert-title"
          descriptionId="alert-desc"
        >
          <h2 id="alert-title">Irreversible Action</h2>
          <p id="alert-desc">This action cannot be undone.</p>
          <button type="button">Confirm</button>
        </ModalDialog>
      );

      const alertDialog = screen.getByRole('alertdialog');
      expect(alertDialog).toBeInTheDocument();
      expect(alertDialog).toHaveAttribute('aria-modal', 'true');
      expect(alertDialog).toHaveAttribute('aria-labelledby', 'alert-title');
      expect(alertDialog).toHaveAttribute('aria-describedby', 'alert-desc');
    });

    it('supports direct aria-label when visual title element is absent', () => {
      render(
        <ModalDialog isOpen={true} ariaLabel="Image Difference Exploration">
          <div>Interactive Visual Difference Controls</div>
          <button type="button">Close</button>
        </ModalDialog>
      );

      const dialog = screen.getByRole('dialog', { name: 'Image Difference Exploration' });
      expect(dialog).toBeInTheDocument();
    });

    it('renders nothing when isOpen is false', () => {
      render(
        <ModalDialog isOpen={false} titleId="hidden-title">
          <h2 id="hidden-title">Should Not Render</h2>
        </ModalDialog>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Initial Focus Management', () => {
    it('moves focus to the first focusable element on mount', async () => {
      render(
        <ModalDialog isOpen={true} titleId="focus-title">
          <h2 id="focus-title">Focus Target</h2>
          <button type="button" data-testid="first-button">
            First Action
          </button>
          <input type="text" data-testid="second-input" />
        </ModalDialog>
      );

      const firstBtn = screen.getByTestId('first-button');
      await waitFor(() => {
        expect(document.activeElement).toBe(firstBtn);
      });
    });

    it('prioritizes initialFocusRef when explicitly provided', async () => {
      function CustomInitialFocusModal() {
        const inputRef = useRef<HTMLInputElement>(null);
        return (
          <ModalDialog isOpen={true} titleId="ref-title" initialFocusRef={inputRef}>
            <h2 id="ref-title">Ref Target</h2>
            <button type="button" data-testid="cancel-btn">
              Cancel
            </button>
            <input ref={inputRef} type="text" data-testid="target-input" />
          </ModalDialog>
        );
      }

      render(<CustomInitialFocusModal />);

      const targetInput = screen.getByTestId('target-input');
      await waitFor(() => {
        expect(document.activeElement).toBe(targetInput);
      });
    });

    it('focuses the dialog container when no focusable elements are present', async () => {
      render(
        <ModalDialog isOpen={true} ariaLabel="Informational Modal">
          <p>Read-only message without interactive elements.</p>
        </ModalDialog>
      );

      const dialog = screen.getByRole('dialog');
      await waitFor(() => {
        expect(document.activeElement).toBe(dialog);
      });
    });
  });

  describe('Keyboard Focus Trap (Tab and Shift+Tab)', () => {
    it('cycles focus from last element back to first on Tab', () => {
      render(
        <ModalDialog isOpen={true} titleId="tab-trap-title">
          <h2 id="tab-trap-title">Tab Trap Test</h2>
          <button type="button" data-testid="first">
            First
          </button>
          <input type="text" data-testid="middle" />
          <button type="button" data-testid="last">
            Last
          </button>
        </ModalDialog>
      );

      const first = screen.getByTestId('first');
      const last = screen.getByTestId('last');

      // Place focus on the last element
      last.focus();
      expect(document.activeElement).toBe(last);

      // Press Tab on the window while last element is active
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });

      // Focus should loop back to the first element
      expect(document.activeElement).toBe(first);
    });

    it('cycles focus from first element back to last on Shift+Tab', () => {
      render(
        <ModalDialog isOpen={true} titleId="shift-tab-title">
          <h2 id="shift-tab-title">Shift Tab Test</h2>
          <button type="button" data-testid="first">
            First
          </button>
          <input type="text" data-testid="middle" />
          <button type="button" data-testid="last">
            Last
          </button>
        </ModalDialog>
      );

      const first = screen.getByTestId('first');
      const last = screen.getByTestId('last');

      // Place focus on the first element
      first.focus();
      expect(document.activeElement).toBe(first);

      // Press Shift + Tab on the window
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

      // Focus should wrap around to the last element
      expect(document.activeElement).toBe(last);
    });
  });

  describe('Escape Key Behavior and Safeguards', () => {
    it('invokes onClose when Escape is pressed on a dismissible modal', () => {
      const onCloseMock = vi.fn();
      render(
        <ModalDialog isOpen={true} onClose={onCloseMock} titleId="esc-title" closeOnEscape={true}>
          <h2 id="esc-title">Dismissible Modal</h2>
          <button type="button">Ok</button>
        </ModalDialog>
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('does NOT invoke onClose when closeOnEscape is false (safeguard)', () => {
      const onCloseMock = vi.fn();
      render(
        <ModalDialog isOpen={true} onClose={onCloseMock} titleId="safe-title" closeOnEscape={false}>
          <h2 id="safe-title">Protected Workflow Modal</h2>
          <button type="button">Must confirm or click cancel</button>
        </ModalDialog>
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('does not dismiss modal on unrelated keys like Space or Enter', () => {
      const onCloseMock = vi.fn();
      render(
        <ModalDialog isOpen={true} onClose={onCloseMock} titleId="key-title">
          <h2 id="key-title">Keyboard Test</h2>
          <button type="button">Action</button>
        </ModalDialog>
      );

      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('Focus Restoration', () => {
    it('restores focus to the triggering element when the modal closes', async () => {
      function TriggerHarness() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button
              type="button"
              data-testid="open-trigger-button"
              onClick={() => setOpen(true)}
            >
              Open Dialog
            </button>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              titleId="restore-title"
            >
              <h2 id="restore-title">Restore Target</h2>
              <button
                type="button"
                data-testid="close-modal-button"
                onClick={() => setOpen(false)}
              >
                Close Dialog
              </button>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<TriggerHarness />);

      const triggerBtn = screen.getByTestId('open-trigger-button');

      // Click to open dialog
      await user.click(triggerBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click to close dialog
      const closeBtn = screen.getByTestId('close-modal-button');
      await user.click(closeBtn);

      // Verify dialog is gone and trigger has focus restored
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(triggerBtn);
      });
    });

    it('restores focus to returnFocusRef when explicitly specified', async () => {
      function CustomReturnHarness() {
        const [open, setOpen] = useState(true);
        const customTargetRef = useRef<HTMLButtonElement>(null);

        return (
          <div>
            <button type="button" data-testid="other-button">Other</button>
            <button ref={customTargetRef} type="button" data-testid="target-return-button">
              Target Return
            </button>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={customTargetRef}
              titleId="custom-restore-title"
            >
              <h2 id="custom-restore-title">Custom Restore</h2>
              <button
                type="button"
                data-testid="dismiss-button"
                onClick={() => setOpen(false)}
              >
                Dismiss
              </button>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<CustomReturnHarness />);

      const dismissBtn = screen.getByTestId('dismiss-button');
      await user.click(dismissBtn);

      const targetReturn = screen.getByTestId('target-return-button');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(targetReturn);
      });
    });
  });

  describe('Background Isolation and Inert Subtree Management', () => {
    it('marks background elements with inert and aria-hidden="true" when modal opens', () => {
      function BackgroundHarness() {
        const [open, setOpen] = useState(true);
        return (
          <div>
            <nav data-testid="bg-nav">
              <a href="#test">Navigation Link</a>
            </nav>
            <main data-testid="bg-main">
              <button type="button" data-testid="bg-button">
                Background Button
              </button>
              <ModalDialog isOpen={open} onClose={() => setOpen(false)} titleId="iso-title">
                <h2 id="iso-title">Isolated Modal</h2>
                <button type="button" data-testid="modal-action">
                  Modal Action
                </button>
              </ModalDialog>
            </main>
          </div>
        );
      }

      render(<BackgroundHarness />);

      const bgNav = screen.getByTestId('bg-nav');
      const bgBtn = screen.getByTestId('bg-button');
      const modalAction = screen.getByTestId('modal-action');

      // Background elements outside the modal must have inert and aria-hidden
      expect(bgNav).toHaveAttribute('inert');
      expect(bgNav).toHaveAttribute('aria-hidden', 'true');
      expect(bgBtn).toHaveAttribute('inert');
      expect(bgBtn).toHaveAttribute('aria-hidden', 'true');

      // The modal content itself must NOT be inert
      expect(modalAction).not.toHaveAttribute('inert');
      expect(modalAction).not.toHaveAttribute('aria-hidden');
    });

    it('does NOT mark ancestors containing the modal as inert', () => {
      function AncestorHarness() {
        return (
          <div data-testid="ancestor-root">
            <div data-testid="ancestor-container">
              <ModalDialog isOpen={true} titleId="anc-title">
                <h2 id="anc-title">Ancestor Test</h2>
                <button type="button">Inside</button>
              </ModalDialog>
            </div>
          </div>
        );
      }

      render(<AncestorHarness />);

      const ancestorRoot = screen.getByTestId('ancestor-root');
      const ancestorContainer = screen.getByTestId('ancestor-container');

      // Neither ancestor containing the modal should be inert
      expect(ancestorRoot).not.toHaveAttribute('inert');
      expect(ancestorContainer).not.toHaveAttribute('inert');
      expect(ancestorRoot).not.toHaveAttribute('aria-hidden');
      expect(ancestorContainer).not.toHaveAttribute('aria-hidden');
    });

    it('restores background elements to original state upon modal close', async () => {
      function ToggleHarness() {
        const [open, setOpen] = useState(true);
        return (
          <div>
            <section data-testid="bg-section">
              <button type="button" data-testid="page-btn">Page Action</button>
            </section>
            <ModalDialog isOpen={open} onClose={() => setOpen(false)} titleId="restore-iso-title">
              <h2 id="restore-iso-title">Restoration Test</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<ToggleHarness />);

      const bgSection = screen.getByTestId('bg-section');
      expect(bgSection).toHaveAttribute('inert');
      expect(bgSection).toHaveAttribute('aria-hidden', 'true');

      // Close modal
      await user.click(screen.getByTestId('close-btn'));

      // Sibling section must have inert and aria-hidden completely removed
      expect(bgSection).not.toHaveAttribute('inert');
      expect(bgSection).not.toHaveAttribute('aria-hidden');
    });

    it('preserves pre-existing inert or aria-hidden attributes when modal closes', async () => {
      function PreExistingHarness() {
        const [open, setOpen] = useState(true);

        return (
          <div>
            <aside
              ref={(el) => {
                if (el) {
                  el.setAttribute('inert', '');
                  try {
                    (el as any).inert = true;
                  } catch {}
                }
              }}
              data-testid="pre-inert"
              aria-hidden="true"
            >
              Permanently Disabled Drawer
            </aside>
            <section data-testid="normal-section">
              Normal Page Section
            </section>
            <ModalDialog isOpen={open} onClose={() => setOpen(false)} titleId="pre-title">
              <h2 id="pre-title">Pre-existing Attributes Test</h2>
              <button
                type="button"
                data-testid="close-pre-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<PreExistingHarness />);

      const preInert = screen.getByTestId('pre-inert');
      const normalSection = screen.getByTestId('normal-section');

      expect(preInert).toHaveAttribute('inert');
      expect(normalSection).toHaveAttribute('inert');

      // Close modal
      await user.click(screen.getByTestId('close-pre-btn'));

      // Pre-existing inert element retains inert; normal section has inert removed
      expect(preInert).toHaveAttribute('inert');
      expect(preInert).toHaveAttribute('aria-hidden', 'true');
      expect(normalSection).not.toHaveAttribute('inert');
      expect(normalSection).not.toHaveAttribute('aria-hidden');
    });

    it('suppresses pointer clicks on inert background elements while modal is open', () => {
      const backgroundClickMock = vi.fn();

      render(
        <div>
          <button
            type="button"
            data-testid="bg-click-btn"
            onClick={backgroundClickMock}
          >
            Background Target
          </button>
          <ModalDialog isOpen={true} titleId="suppress-title">
            <h2 id="suppress-title">Suppression Modal</h2>
            <button type="button" data-testid="modal-click-btn">
              Modal Target
            </button>
          </ModalDialog>
        </div>
      );

      const bgBtn = screen.getByTestId('bg-click-btn');
      expect(bgBtn).toHaveAttribute('inert');

      // Attempt clicking the background button
      fireEvent.click(bgBtn);
      expect(backgroundClickMock).not.toHaveBeenCalled();
    });

    it('redirects focus into the modal if focus is attempted on an inert background element', async () => {
      render(
        <div>
          <button type="button" data-testid="bg-focus-target">
            Background Focus Target
          </button>
          <ModalDialog isOpen={true} titleId="redirect-title">
            <h2 id="redirect-title">Focus Redirection Modal</h2>
            <button type="button" data-testid="modal-focus-target">
              Modal Focus Target
            </button>
          </ModalDialog>
        </div>
      );

      const bgBtn = screen.getByTestId('bg-focus-target');
      const modalBtn = screen.getByTestId('modal-focus-target');

      // Initial focus moves to modal button
      await waitFor(() => {
        expect(document.activeElement).toBe(modalBtn);
      });

      // Attempt focusing background button
      fireEvent.focusIn(bgBtn);

      // Focus must be returned into the modal
      expect(document.activeElement).toBe(modalBtn);
    });
  });

  describe('Nested Modal Dialog Coordination', () => {
    it('dismisses only the topmost modal when Escape is pressed', async () => {
      function NestedModalsHarness() {
        const [parentOpen, setParentOpen] = useState(true);
        const [childOpen, setChildOpen] = useState(false);

        return (
          <div>
            <ModalDialog
              isOpen={parentOpen}
              onClose={() => setParentOpen(false)}
              titleId="parent-title"
            >
              <h2 id="parent-title">Parent Action Details</h2>
              <button
                type="button"
                data-testid="open-child-btn"
                onClick={() => setChildOpen(true)}
              >
                Open Verification
              </button>

              <ModalDialog
                isOpen={childOpen}
                onClose={() => setChildOpen(false)}
                titleId="child-title"
              >
                <h2 id="child-title">Child Verification Confirmation</h2>
                <button type="button" data-testid="child-action-btn">Child Action</button>
              </ModalDialog>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<NestedModalsHarness />);

      expect(screen.getByText('Parent Action Details')).toBeInTheDocument();
      expect(screen.queryByText('Child Verification Confirmation')).not.toBeInTheDocument();

      // Open child modal
      await user.click(screen.getByTestId('open-child-btn'));
      expect(screen.getByText('Child Verification Confirmation')).toBeInTheDocument();

      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);

      // Press Escape: should close the topmost (child) modal only
      fireEvent.keyDown(window, { key: 'Escape' });

      // Parent modal remains in the document
      expect(screen.getByText('Parent Action Details')).toBeInTheDocument();
      // Child modal is dismissed
      expect(screen.queryByText('Child Verification Confirmation')).not.toBeInTheDocument();
    });

    it('isolates parent modal controls when child modal opens without making parent container inert', async () => {
      function NestedIsolationHarness() {
        const [parentOpen, setParentOpen] = useState(true);
        const [childOpen, setChildOpen] = useState(false);
        const parentBtnClicked = vi.fn();

        return (
          <div>
            <aside data-testid="outer-page-content">
              Outer Page Content
            </aside>
            <ModalDialog
              isOpen={parentOpen}
              onClose={() => setParentOpen(false)}
              titleId="p-title"
            >
              <h2 id="p-title">Parent Dialog Title</h2>
              <button
                type="button"
                data-testid="parent-workflow-btn"
                onClick={parentBtnClicked}
              >
                Parent Workflow Action
              </button>
              <button
                type="button"
                data-testid="trigger-child-btn"
                onClick={() => setChildOpen(true)}
              >
                Open Child Modal
              </button>

              <ModalDialog
                isOpen={childOpen}
                onClose={() => setChildOpen(false)}
                titleId="c-title"
              >
                <h2 id="c-title">Child Dialog Title</h2>
                <button type="button" data-testid="child-action-btn">
                  Confirm Child Action
                </button>
              </ModalDialog>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<NestedIsolationHarness />);

      const outerContent = screen.getByTestId('outer-page-content');
      const parentWorkflowBtn = screen.getByTestId('parent-workflow-btn');
      const triggerChildBtn = screen.getByTestId('trigger-child-btn');

      // Before child opens: outer content is inert, parent controls are interactive
      expect(outerContent).toHaveAttribute('inert');
      expect(parentWorkflowBtn).not.toHaveAttribute('inert');

      // Open child modal
      await user.click(triggerChildBtn);

      const childBtn = screen.getByTestId('child-action-btn');

      // 1. Parent controls (siblings of child modal) are now inert
      expect(parentWorkflowBtn).toHaveAttribute('inert');
      expect(parentWorkflowBtn).toHaveAttribute('aria-hidden', 'true');
      expect(triggerChildBtn).toHaveAttribute('inert');

      // 2. Child modal controls are NOT inert
      expect(childBtn).not.toHaveAttribute('inert');
      expect(childBtn).not.toHaveAttribute('aria-hidden');

      // 3. Parent container (ancestor of child) is NOT inert
      const parentDialog = screen.getAllByRole('dialog')[0];
      expect(parentDialog).not.toHaveAttribute('inert');
    });

    it('restores parent modal interactivity and trigger focus when child modal closes', async () => {
      function NestedRestorationHarness() {
        const [parentOpen, setParentOpen] = useState(true);
        const [childOpen, setChildOpen] = useState(false);

        return (
          <div>
            <div data-testid="outer-bg">Page Background</div>
            <ModalDialog
              isOpen={parentOpen}
              onClose={() => setParentOpen(false)}
              titleId="p-restore-title"
            >
              <h2 id="p-restore-title">Parent Title</h2>
              <button
                type="button"
                data-testid="child-trigger-btn"
                onClick={() => setChildOpen(true)}
              >
                Open Verification
              </button>

              <ModalDialog
                isOpen={childOpen}
                onClose={() => setChildOpen(false)}
                titleId="c-restore-title"
              >
                <h2 id="c-restore-title">Child Title</h2>
                <button
                  type="button"
                  data-testid="close-child-btn"
                  onClick={() => setChildOpen(false)}
                >
                  Close Child
                </button>
              </ModalDialog>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<NestedRestorationHarness />);

      const triggerBtn = screen.getByTestId('child-trigger-btn');
      const outerBg = screen.getByTestId('outer-bg');

      // Open child modal
      await user.click(triggerBtn);
      expect(triggerBtn).toHaveAttribute('inert');

      // Close child modal
      const closeChildBtn = screen.getByTestId('close-child-btn');
      await user.click(closeChildBtn);

      // Child modal is gone
      expect(screen.queryByTestId('close-child-btn')).not.toBeInTheDocument();

      // Parent controls must have inert removed
      expect(triggerBtn).not.toHaveAttribute('inert');
      expect(triggerBtn).not.toHaveAttribute('aria-hidden');

      // Outer background remains inert while parent modal is open
      expect(outerBg).toHaveAttribute('inert');

      // Focus is restored to the child trigger button in the parent dialog
      await waitFor(() => {
        expect(document.activeElement).toBe(triggerBtn);
      });
    });
  });

  describe('Document Body Scroll Lock and Event Cleanup', () => {
    it('sets body overflow to hidden while open and restores on unmount', () => {
      document.body.style.overflow = 'auto';

      const { unmount } = render(
        <ModalDialog isOpen={true} titleId="cleanup-title">
          <h2 id="cleanup-title">Scroll Lock Modal</h2>
          <button type="button">Dismiss</button>
        </ModalDialog>
      );

      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('auto');
    });

    it('cleans up keydown event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <ModalDialog isOpen={true} titleId="listener-title">
          <h2 id="listener-title">Listener Test</h2>
          <button type="button">Dismiss</button>
        </ModalDialog>
      );

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('cleans up all temporary attributes and global guards on abrupt unmount', () => {
      const { unmount } = render(
        <div>
          <div data-testid="bg-unmount">Background</div>
          <ModalDialog isOpen={true} titleId="abrupt-title">
            <h2 id="abrupt-title">Abrupt Unmount Test</h2>
            <button type="button">Action</button>
          </ModalDialog>
        </div>
      );

      const bgElement = screen.getByTestId('bg-unmount');
      expect(bgElement).toHaveAttribute('inert');

      unmount();

      expect(bgElement).not.toHaveAttribute('inert');
      expect(bgElement).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('Backdrop Click Handling', () => {
    it('does not close on backdrop click by default (closeOnBackdropClick=false)', () => {
      const onCloseMock = vi.fn();
      const { container } = render(
        <ModalDialog isOpen={true} onClose={onCloseMock} titleId="backdrop-title">
          <h2 id="backdrop-title">No Backdrop Dismiss</h2>
          <button type="button">Action</button>
        </ModalDialog>
      );

      const backdrop = container.firstChild as HTMLElement;
      fireEvent.click(backdrop);
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('closes on backdrop click when closeOnBackdropClick is explicitly enabled', () => {
      const onCloseMock = vi.fn();
      const { container } = render(
        <ModalDialog
          isOpen={true}
          onClose={onCloseMock}
          closeOnBackdropClick={true}
          titleId="backdrop-title-2"
        >
          <h2 id="backdrop-title-2">Backdrop Dismissible</h2>
          <button type="button">Action</button>
        </ModalDialog>
      );

      const backdrop = container.firstChild as HTMLElement;
      fireEvent.click(backdrop);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside dialog content even if closeOnBackdropClick is true', () => {
      const onCloseMock = vi.fn();
      render(
        <ModalDialog
          isOpen={true}
          onClose={onCloseMock}
          closeOnBackdropClick={true}
          titleId="backdrop-content-title"
        >
          <h2 id="backdrop-content-title">Inner Content Target</h2>
          <button type="button" data-testid="inner-btn">Inside Button</button>
        </ModalDialog>
      );

      const innerBtn = screen.getByTestId('inner-btn');
      fireEvent.click(innerBtn);
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('Form Handling and State Stability within ModalDialog', () => {
    it('allows typing into form inputs without stealing focus or closing dialog', async () => {
      function FormModalHarness() {
        const [isOpen, setIsOpen] = useState(true);
        const [text, setText] = useState('');
        const [submitted, setSubmitted] = useState<string | null>(null);

        return (
          <ModalDialog isOpen={isOpen} onClose={() => setIsOpen(false)} titleId="form-title">
            <h2 id="form-title">Editable Form Modal</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(text);
              }}
            >
              <label htmlFor="field-input">Field Value</label>
              <input
                id="field-input"
                data-testid="field-input"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" data-testid="submit-btn">
                Save
              </button>
            </form>
            {submitted && <p data-testid="submitted-value">{submitted}</p>}
          </ModalDialog>
        );
      }

      const user = userEvent.setup();
      render(<FormModalHarness />);

      const input = screen.getByTestId('field-input');
      await user.type(input, 'Verified environmental indicator');

      expect(input).toHaveValue('Verified environmental indicator');

      const submitBtn = screen.getByTestId('submit-btn');
      await user.click(submitBtn);

      expect(screen.getByTestId('submitted-value')).toHaveTextContent(
        'Verified environmental indicator'
      );
    });
  });

  describe('getFocusableElements helper utility', () => {
    it('returns only interactive, non-disabled, and visible elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">Valid Button</button>
        <button id="btn-disabled" disabled>Disabled Button</button>
        <a id="link1" href="https://example.com">Valid Link</a>
        <a id="link-nohref">No href link</a>
        <input id="input1" type="text" />
        <input id="hidden-input" type="hidden" />
        <div id="tabindex-item" tabindex="0">Custom focusable</div>
        <div id="tabindex-neg" tabindex="-1">Non-focusable tabindex</div>
        <button id="hidden-style" style="display: none;">Hidden Button</button>
        <button id="aria-hidden" aria-hidden="true">Aria Hidden</button>
        <button id="btn-inert" inert>Inert Button</button>
      `;

      const focusables = getFocusableElements(container);
      const ids = focusables.map((el) => el.id);

      expect(ids).toContain('btn1');
      expect(ids).toContain('link1');
      expect(ids).toContain('input1');
      expect(ids).toContain('tabindex-item');

      expect(ids).not.toContain('btn-disabled');
      expect(ids).not.toContain('link-nohref');
      expect(ids).not.toContain('hidden-input');
      expect(ids).not.toContain('tabindex-neg');
      expect(ids).not.toContain('hidden-style');
      expect(ids).not.toContain('aria-hidden');
      expect(ids).not.toContain('btn-inert');
    });

    it('excludes elements nested inside an inert or aria-hidden parent', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div inert>
          <button id="nested-inert-btn">Nested Inert</button>
        </div>
        <div aria-hidden="true">
          <button id="nested-hidden-btn">Nested Hidden</button>
        </div>
        <div>
          <button id="valid-btn">Valid Active</button>
        </div>
      `;

      const focusables = getFocusableElements(container);
      const ids = focusables.map((el) => el.id);

      expect(ids).toEqual(['valid-btn']);
      expect(ids).not.toContain('nested-inert-btn');
      expect(ids).not.toContain('nested-hidden-btn');
    });
  });

  describe('Hardened Cleanup and Failure Resilience (Wave 3B Regression)', () => {
    it('restores aria-hidden, body overflow, and focus even when inert removal throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Harness() {
        const [open, setOpen] = useState(true);
        const triggerRef = useRef<HTMLButtonElement>(null);
        return (
          <div>
            <button ref={triggerRef} type="button" data-testid="page-trigger">
              Trigger
            </button>
            <div data-testid="bg-content">Background Node</div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
              titleId="inert-err-title"
            >
              <h2 id="inert-err-title">Inert Failure Modal</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      render(<Harness />);

      const bgNode = screen.getByTestId('bg-content');
      const trigger = screen.getByTestId('page-trigger');
      expect(bgNode).toHaveAttribute('inert');
      expect(bgNode).toHaveAttribute('aria-hidden', 'true');
      expect(document.body.style.overflow).toBe('hidden');

      // Intercept removeAttribute on bgNode so that removing 'inert' throws
      const originalRemoveAttribute = bgNode.removeAttribute.bind(bgNode);
      vi.spyOn(bgNode, 'removeAttribute').mockImplementation((attr: string) => {
        if (attr === 'inert') {
          throw new Error('Simulated inert removeAttribute failure');
        }
        return originalRemoveAttribute(attr);
      });

      // Trigger modal close
      fireEvent.click(screen.getByTestId('close-btn'));

      // 1. Error was logged and not swallowed silently
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error restoring inert attribute'),
        expect.any(Error)
      );

      // 2. aria-hidden was still independently restored!
      expect(bgNode).not.toHaveAttribute('aria-hidden');

      // 3. Body overflow was still restored!
      expect(document.body.style.overflow).toBe('auto');

      // 4. Focus was still restored!
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });

      // 5. Modal stack and guards were cleaned up
      expect(__getActiveModalStackCount()).toBe(0);
      expect(__isGuardsAttached()).toBe(false);

      consoleSpy.mockRestore();
    });

    it('restores inert, body overflow, and focus even when aria-hidden restoration throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Harness() {
        const [open, setOpen] = useState(true);
        const triggerRef = useRef<HTMLButtonElement>(null);
        return (
          <div>
            <button ref={triggerRef} type="button" data-testid="page-trigger">
              Trigger
            </button>
            <div data-testid="bg-content">Background Node</div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
              titleId="aria-err-title"
            >
              <h2 id="aria-err-title">Aria-hidden Failure Modal</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      render(<Harness />);

      const bgNode = screen.getByTestId('bg-content');
      const trigger = screen.getByTestId('page-trigger');
      expect(bgNode).toHaveAttribute('inert');
      expect(bgNode).toHaveAttribute('aria-hidden', 'true');

      // Intercept removeAttribute on bgNode so that removing 'aria-hidden' throws
      const originalRemoveAttribute = bgNode.removeAttribute.bind(bgNode);
      vi.spyOn(bgNode, 'removeAttribute').mockImplementation((attr: string) => {
        if (attr === 'aria-hidden') {
          throw new Error('Simulated aria-hidden removeAttribute failure');
        }
        return originalRemoveAttribute(attr);
      });

      // Trigger modal close
      fireEvent.click(screen.getByTestId('close-btn'));

      // 1. Error was logged and not swallowed silently
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error restoring aria-hidden attribute'),
        expect.any(Error)
      );

      // 2. inert was still independently restored!
      expect(bgNode).not.toHaveAttribute('inert');

      // 3. Body overflow was still restored!
      expect(document.body.style.overflow).toBe('auto');

      // 4. Focus was still restored!
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });

      expect(__getActiveModalStackCount()).toBe(0);
      expect(__isGuardsAttached()).toBe(false);

      consoleSpy.mockRestore();
    });

    it('restores focus and isolation attributes even when body overflow restoration throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Harness() {
        const [open, setOpen] = useState(true);
        const triggerRef = useRef<HTMLButtonElement>(null);
        return (
          <div>
            <button ref={triggerRef} type="button" data-testid="page-trigger">
              Trigger
            </button>
            <div data-testid="bg-content">Background Node</div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
              titleId="overflow-err-title"
            >
              <h2 id="overflow-err-title">Overflow Failure Modal</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      render(<Harness />);

      const bgNode = screen.getByTestId('bg-content');
      const trigger = screen.getByTestId('page-trigger');

      // Mock overflow setter on CSSStyleDeclaration to throw only when restoring 'auto' on document.body.style
      const overflowDescriptor = Object.getOwnPropertyDescriptor(
        CSSStyleDeclaration.prototype,
        'overflow'
      );
      let overflowSpy: any = null;
      if (overflowDescriptor && overflowDescriptor.set) {
        overflowSpy = vi.spyOn(CSSStyleDeclaration.prototype, 'overflow', 'set').mockImplementation(function (
          this: CSSStyleDeclaration,
          value: string
        ) {
          if (this === document.body.style && value === 'auto') {
            throw new Error('Simulated body overflow setter failure');
          }
          overflowDescriptor.set!.call(this, value);
        });
      }

      try {
        // Close modal
        fireEvent.click(screen.getByTestId('close-btn'));

        // 1. Error was logged and not swallowed silently
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error restoring body overflow'),
          expect.any(Error)
        );

        // 2. Background isolation attributes were restored!
        expect(bgNode).not.toHaveAttribute('inert');
        expect(bgNode).not.toHaveAttribute('aria-hidden');

        // 3. Focus was still restored to trigger!
        await waitFor(() => {
          expect(document.activeElement).toBe(trigger);
        });

        expect(__getActiveModalStackCount()).toBe(0);
        expect(__isGuardsAttached()).toBe(false);
      } finally {
        if (overflowSpy) overflowSpy.mockRestore();
        consoleSpy.mockRestore();
      }
    });

    it('cleans up body overflow, attributes, and listeners even when focus restoration throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Harness() {
        const [open, setOpen] = useState(true);
        const triggerRef = useRef<HTMLButtonElement>(null);
        return (
          <div>
            <button ref={triggerRef} type="button" data-testid="page-trigger">
              Trigger
            </button>
            <div data-testid="bg-content">Background Node</div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
              titleId="focus-err-title"
            >
              <h2 id="focus-err-title">Focus Failure Modal</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Inside Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      render(<Harness />);

      const bgNode = screen.getByTestId('bg-content');
      const trigger = screen.getByTestId('page-trigger');

      // Mock focus on trigger to throw
      const focusSpy = vi.spyOn(trigger, 'focus').mockImplementation(() => {
        throw new Error('Simulated target.focus() failure');
      });

      try {
        // Close modal
        fireEvent.click(screen.getByTestId('close-btn'));

        // 1. Error was logged and not swallowed silently
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error restoring focus'),
          expect.any(Error)
        );

        // 2. Body overflow was restored!
        expect(document.body.style.overflow).toBe('auto');

        // 3. Background isolation was restored!
        expect(bgNode).not.toHaveAttribute('inert');
        expect(bgNode).not.toHaveAttribute('aria-hidden');

        // 4. Modal stack was cleaned up!
        expect(__getActiveModalStackCount()).toBe(0);
        expect(__isGuardsAttached()).toBe(false);
      } finally {
        focusSpy.mockRestore();
        consoleSpy.mockRestore();
      }
    });

    it('cleans up body overflow, attributes, and focus even when removeEventListener throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Harness() {
        const [open, setOpen] = useState(true);
        const triggerRef = useRef<HTMLButtonElement>(null);
        return (
          <div>
            <button ref={triggerRef} type="button" data-testid="page-trigger">
              Trigger
            </button>
            <div data-testid="bg-content">Background Node</div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
              titleId="listener-err-title"
            >
              <h2 id="listener-err-title">Listener Failure Modal</h2>
              <button
                type="button"
                data-testid="close-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      render(<Harness />);

      const bgNode = screen.getByTestId('bg-content');
      const trigger = screen.getByTestId('page-trigger');

      // Mock window.removeEventListener for keydown to throw
      const originalRemoveEventListener = window.removeEventListener.bind(window);
      const listenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, listener: any, options?: any) => {
        if (type === 'keydown') {
          throw new Error('Simulated window.removeEventListener failure');
        }
        return originalRemoveEventListener(type, listener, options);
      });

      try {
        // Close modal
        fireEvent.click(screen.getByTestId('close-btn'));

        // 1. Error was logged and not swallowed silently
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error removing keydown event listener'),
          expect.any(Error)
        );

        // 2. Isolation attributes were restored!
        expect(bgNode).not.toHaveAttribute('inert');
        expect(bgNode).not.toHaveAttribute('aria-hidden');

        // 3. Body overflow was restored!
        expect(document.body.style.overflow).toBe('auto');

        // 4. Focus was restored!
        await waitFor(() => {
          expect(document.activeElement).toBe(trigger);
        });

        expect(__getActiveModalStackCount()).toBe(0);
      } finally {
        listenerSpy.mockRestore();
        consoleSpy.mockRestore();
      }
    });

    it('preserves pre-existing aria-hidden="false" and pre-existing inert attributes correctly', async () => {
      function PreExistingComplexHarness() {
        const [open, setOpen] = useState(true);
        return (
          <div>
            <div
              ref={(el) => {
                if (el) {
                  el.setAttribute('inert', '');
                  try {
                    (el as any).inert = true;
                  } catch {}
                }
              }}
              data-testid="pre-inert-el"
            >
              Pre-existing Inert Element
            </div>
            <div data-testid="pre-false-aria" aria-hidden="false">
              Pre-existing Explicit Visible Element
            </div>
            <div data-testid="pre-true-aria" aria-hidden="true">
              Pre-existing Hidden Element
            </div>
            <div data-testid="pre-normal-el">
              Normal Unadorned Element
            </div>
            <ModalDialog
              isOpen={open}
              onClose={() => setOpen(false)}
              titleId="complex-attrs-title"
            >
              <h2 id="complex-attrs-title">Attribute Preservation Test</h2>
              <button
                type="button"
                data-testid="close-complex-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </ModalDialog>
          </div>
        );
      }

      const user = userEvent.setup();
      render(<PreExistingComplexHarness />);

      const preInertEl = screen.getByTestId('pre-inert-el');
      const preFalseAria = screen.getByTestId('pre-false-aria');
      const preTrueAria = screen.getByTestId('pre-true-aria');
      const preNormalEl = screen.getByTestId('pre-normal-el');

      // While modal is open, all background elements have inert and aria-hidden="true"
      expect(preInertEl).toHaveAttribute('inert');
      expect(preFalseAria).toHaveAttribute('aria-hidden', 'true');
      expect(preTrueAria).toHaveAttribute('aria-hidden', 'true');
      expect(preNormalEl).toHaveAttribute('inert');
      expect(preNormalEl).toHaveAttribute('aria-hidden', 'true');

      // Close modal
      await user.click(screen.getByTestId('close-complex-btn'));

      // Check preservation of exact pre-existing states:
      // 1. Pre-existing inert element retains inert
      expect(preInertEl).toHaveAttribute('inert');
      // 2. Pre-existing aria-hidden="false" element is restored to "false" (NOT removed)
      expect(preFalseAria).toHaveAttribute('aria-hidden', 'false');
      // 3. Pre-existing aria-hidden="true" element retains "true"
      expect(preTrueAria).toHaveAttribute('aria-hidden', 'true');
      // 4. Normal element has both inert and aria-hidden removed
      expect(preNormalEl).not.toHaveAttribute('inert');
      expect(preNormalEl).not.toHaveAttribute('aria-hidden');
    });

    it('preserves pre-existing body overflow values of "scroll", "auto", and empty string across modal lifecycle', () => {
      // 1. Test "scroll" preservation
      document.body.style.overflow = 'scroll';
      const { unmount: unmount1 } = render(
        <ModalDialog isOpen={true} titleId="scroll-t">
          <h2 id="scroll-t">Scroll Test</h2>
        </ModalDialog>
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount1();
      expect(document.body.style.overflow).toBe('scroll');

      // 2. Test "auto" preservation
      document.body.style.overflow = 'auto';
      const { unmount: unmount2 } = render(
        <ModalDialog isOpen={true} titleId="auto-t">
          <h2 id="auto-t">Auto Test</h2>
        </ModalDialog>
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount2();
      expect(document.body.style.overflow).toBe('auto');

      // 3. Test empty string "" preservation
      document.body.style.overflow = '';
      const { unmount: unmount3 } = render(
        <ModalDialog isOpen={true} titleId="empty-t">
          <h2 id="empty-t">Empty Test</h2>
        </ModalDialog>
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount3();
      expect(document.body.style.overflow).toBe('');
    });

    it('correctly handles full nested modal lifecycle: child opening, child closure, parent restoration, and parent closure', async () => {
      function FullNestedLifecycleHarness() {
        const [parentOpen, setParentOpen] = useState(false);
        const [childOpen, setChildOpen] = useState(false);
        const parentTriggerRef = useRef<HTMLButtonElement>(null);
        const childTriggerRef = useRef<HTMLButtonElement>(null);

        return (
          <div>
            <button
              ref={parentTriggerRef}
              type="button"
              data-testid="open-parent-trigger"
              onClick={() => setParentOpen(true)}
            >
              Open Parent
            </button>
            <div data-testid="page-background">Main Page Content</div>

            <ModalDialog
              isOpen={parentOpen}
              onClose={() => setParentOpen(false)}
              returnFocusRef={parentTriggerRef}
              titleId="parent-life-title"
            >
              <h2 id="parent-life-title">Parent Workspace</h2>
              <button
                ref={childTriggerRef}
                type="button"
                data-testid="open-child-trigger"
                onClick={() => setChildOpen(true)}
              >
                Open Verification Child
              </button>
              <button
                type="button"
                data-testid="close-parent-btn"
                onClick={() => setParentOpen(false)}
              >
                Close Parent
              </button>

              <ModalDialog
                isOpen={childOpen}
                onClose={() => setChildOpen(false)}
                returnFocusRef={childTriggerRef}
                titleId="child-life-title"
              >
                <h2 id="child-life-title">Child Confirmation</h2>
                <button
                  type="button"
                  data-testid="close-child-btn"
                  onClick={() => setChildOpen(false)}
                >
                  Confirm and Close Child
                </button>
              </ModalDialog>
            </ModalDialog>
          </div>
        );
      }

      document.body.style.overflow = 'auto';
      const user = userEvent.setup();
      render(<FullNestedLifecycleHarness />);

      const pageBg = screen.getByTestId('page-background');
      const openParentTrigger = screen.getByTestId('open-parent-trigger');

      // --- PHASE 1: Open Parent Modal ---
      await user.click(openParentTrigger);
      expect(document.body.style.overflow).toBe('hidden');
      expect(pageBg).toHaveAttribute('inert');
      expect(__getActiveModalStackCount()).toBe(1);
      expect(__isGuardsAttached()).toBe(true);

      const openChildTrigger = screen.getByTestId('open-child-trigger');
      const closeParentBtn = screen.getByTestId('close-parent-btn');
      expect(openChildTrigger).not.toHaveAttribute('inert');
      expect(closeParentBtn).not.toHaveAttribute('inert');

      // --- PHASE 2: Open Child Modal ---
      await user.click(openChildTrigger);
      expect(__getActiveModalStackCount()).toBe(2);
      expect(document.body.style.overflow).toBe('hidden');

      // Page background remains inert
      expect(pageBg).toHaveAttribute('inert');
      // Parent modal controls are now inert while child is open
      expect(openChildTrigger).toHaveAttribute('inert');
      expect(closeParentBtn).toHaveAttribute('inert');

      const closeChildBtn = screen.getByTestId('close-child-btn');
      expect(closeChildBtn).not.toHaveAttribute('inert');

      // --- PHASE 3: Close Child Modal ---
      await user.click(closeChildBtn);
      expect(__getActiveModalStackCount()).toBe(1);

      // Parent controls must be restored and interactive!
      expect(openChildTrigger).not.toHaveAttribute('inert');
      expect(openChildTrigger).not.toHaveAttribute('aria-hidden');
      expect(closeParentBtn).not.toHaveAttribute('inert');
      expect(closeParentBtn).not.toHaveAttribute('aria-hidden');

      // Outer page background MUST remain isolated!
      expect(pageBg).toHaveAttribute('inert');
      expect(pageBg).toHaveAttribute('aria-hidden', 'true');

      // Body overflow MUST remain hidden while parent is open!
      expect(document.body.style.overflow).toBe('hidden');

      // Focus MUST be restored to the child trigger button in the parent dialog!
      await waitFor(() => {
        expect(document.activeElement).toBe(openChildTrigger);
      });

      // --- PHASE 4: Close Parent Modal ---
      await user.click(closeParentBtn);
      expect(__getActiveModalStackCount()).toBe(0);

      // Outer page background is restored!
      expect(pageBg).not.toHaveAttribute('inert');
      expect(pageBg).not.toHaveAttribute('aria-hidden');

      // Body overflow is restored to 'auto'!
      expect(document.body.style.overflow).toBe('auto');

      // Global guards are detached!
      expect(__isGuardsAttached()).toBe(false);

      // Focus is restored to the parent trigger button on the page!
      await waitFor(() => {
        expect(document.activeElement).toBe(openParentTrigger);
      });
    });

    it('directly validates restoreElementIsolation helper independence when sub-operations fail', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const el = document.createElement('div');
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');

      // Mock removeAttribute to throw on 'inert'
      const origRemove = el.removeAttribute.bind(el);
      vi.spyOn(el, 'removeAttribute').mockImplementation((attr: string) => {
        if (attr === 'inert') {
          throw new Error('Failing removeAttribute inert');
        }
        return origRemove(attr);
      });

      // Call restoreElementIsolation
      restoreElementIsolation(el, { hadInert: false, originalAriaHidden: null });

      // Error logged for inert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error restoring inert attribute'),
        expect.any(Error)
      );

      // aria-hidden was still removed!
      expect(el.hasAttribute('aria-hidden')).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});

