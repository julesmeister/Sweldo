/**
 * Debug script to help identify what changes after delete operations
 * Copy and paste this into browser console to monitor state changes
 */

// Debug utility to monitor form field interactions
function debugFormFieldIssue() {
  console.log('🔍 Starting form field interaction debugging...');
  
  // Store initial state
  const initialState = {
    bodyOverflow: document.body.style.overflow,
    bodyClasses: Array.from(document.body.classList),
    documentOverflow: document.documentElement.style.overflow,
    activeElement: document.activeElement,
    inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
      id: el.id,
      className: el.className,
      disabled: el.disabled,
      readOnly: el.readOnly,
      style: el.style.cssText,
      pointerEvents: getComputedStyle(el).pointerEvents,
      zIndex: getComputedStyle(el).zIndex,
      position: getComputedStyle(el).position
    }))
  };
  
  console.log('📊 Initial state captured:', initialState);
  
  // Function to check current state
  function checkCurrentState() {
    const currentState = {
      bodyOverflow: document.body.style.overflow,
      bodyClasses: Array.from(document.body.classList),
      documentOverflow: document.documentElement.style.overflow,
      activeElement: document.activeElement,
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
        id: el.id,
        className: el.className,
        disabled: el.disabled,
        readOnly: el.readOnly,
        style: el.style.cssText,
        pointerEvents: getComputedStyle(el).pointerEvents,
        zIndex: getComputedStyle(el).zIndex,
        position: getComputedStyle(el).position
      }))
    };
    
    console.log('🔄 Current state:', currentState);
    
    // Compare with initial state
    if (currentState.bodyOverflow !== initialState.bodyOverflow) {
      console.log('⚠️ BODY OVERFLOW CHANGED:', 
        'from:', initialState.bodyOverflow, 
        'to:', currentState.bodyOverflow
      );
    }
    
    if (JSON.stringify(currentState.bodyClasses) !== JSON.stringify(initialState.bodyClasses)) {
      console.log('⚠️ BODY CLASSES CHANGED:', 
        'from:', initialState.bodyClasses, 
        'to:', currentState.bodyClasses
      );
    }
    
    // Check for CSS changes on inputs
    currentState.inputs.forEach((current, index) => {
      const initial = initialState.inputs[index];
      if (initial && (
        current.pointerEvents !== initial.pointerEvents ||
        current.disabled !== initial.disabled ||
        current.style !== initial.style
      )) {
        console.log('⚠️ INPUT FIELD CHANGED:', current.id || index, {
          pointerEvents: { from: initial.pointerEvents, to: current.pointerEvents },
          disabled: { from: initial.disabled, to: current.disabled },
          style: { from: initial.style, to: current.style }
        });
      }
    });
  }
  
  // Monitor for changes
  const observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.target === document.body || 
           mutation.target === document.documentElement ||
           mutation.target.matches('input, textarea, select'))) {
        hasRelevantChanges = true;
      }
    });
    
    if (hasRelevantChanges) {
      console.log('🔄 DOM change detected, checking state...');
      setTimeout(checkCurrentState, 100); // Small delay to let changes settle
    }
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['style', 'class', 'disabled', 'readonly']
  });
  
  // Also monitor for toast notifications
  const originalToast = window.toast;
  if (originalToast) {
    window.toast = new Proxy(originalToast, {
      get(target, prop) {
        if (typeof target[prop] === 'function') {
          return function(...args) {
            console.log('🍞 Toast called:', prop, args);
            setTimeout(checkCurrentState, 500); // Check state after toast
            return target[prop].apply(target, args);
          };
        }
        return target[prop];
      }
    });
  }
  
  console.log('✅ Debugging setup complete. Now perform a delete operation and watch the console.');
  
  // Return cleanup function
  return () => {
    observer.disconnect();
    if (originalToast) window.toast = originalToast;
    console.log('🧹 Debugging cleaned up');
  };
}

// Auto-start debugging
const cleanup = debugFormFieldIssue();

// Provide manual check function
window.checkFormState = () => {
  console.log('📊 Manual state check requested...');
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input, index) => {
    const computed = getComputedStyle(input);
    console.log(`Input ${index}:`, {
      id: input.id,
      disabled: input.disabled,
      readOnly: input.readOnly,
      pointerEvents: computed.pointerEvents,
      zIndex: computed.zIndex,
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity
    });
  });
  
  // Also check for overlaying elements
  const highZElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const z = parseInt(getComputedStyle(el).zIndex);
    return z > 1000;
  });
  
  console.log('High z-index elements:', highZElements.map(el => ({
    element: el.tagName,
    className: el.className,
    zIndex: getComputedStyle(el).zIndex
  })));
};

console.log('🚀 Debug script loaded! Use window.checkFormState() for manual checks.');