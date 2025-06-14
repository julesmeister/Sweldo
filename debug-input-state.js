// EMERGENCY DIAGNOSTIC TOOL - Copy/paste this into browser console
// Run this BEFORE performing delete operation, then check after

console.log("🔍 INPUT STATE DIAGNOSTIC TOOL LOADED");

// Store original states for comparison
let beforeState = {};
let afterState = {};

// Function to capture complete input state
function captureInputState(label) {
  const state = {
    timestamp: new Date().toISOString(),
    // Document properties
    documentOverflow: document.body.style.overflow,
    activeElement: document.activeElement?.tagName + (document.activeElement?.className ? '.' + document.activeElement.className : ''),
    
    // Find all inputs
    allInputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
      tag: el.tagName,
      type: el.type || 'N/A',
      disabled: el.disabled,
      readOnly: el.readOnly,
      style: {
        pointerEvents: getComputedStyle(el).pointerEvents,
        userSelect: getComputedStyle(el).userSelect,
        zIndex: getComputedStyle(el).zIndex,
        position: getComputedStyle(el).position,
        visibility: getComputedStyle(el).visibility,
        display: getComputedStyle(el).display
      },
      value: el.value?.substring(0, 20) || '',
      id: el.id || 'no-id',
      className: el.className || 'no-class',
      tabIndex: el.tabIndex,
      parentOverlay: findBlockingOverlay(el)
    })),
    
    // Loading states
    loadingStates: {
      loadingBarVisible: !!document.querySelector('[class*="z-[9999]"]'),
      anyLoadingElements: Array.from(document.querySelectorAll('[class*="loading"], [class*="spinner"]')).length,
      globalLoadingStore: window.zustandStores ? 'CHECK_STORE' : 'NO_ZUSTAND'
    },
    
    // Overlay detection
    highZIndexElements: Array.from(document.querySelectorAll('*')).filter(el => {
      const zIndex = parseInt(getComputedStyle(el).zIndex);
      return zIndex > 1000;
    }).map(el => ({
      tag: el.tagName,
      class: el.className,
      zIndex: getComputedStyle(el).zIndex,
      position: getComputedStyle(el).position,
      visible: getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
    }))
  };
  
  console.log(`📊 ${label} STATE:`, state);
  return state;
}

// Function to find blocking overlays above an element
function findBlockingOverlay(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const elementAtPoint = document.elementFromPoint(centerX, centerY);
  
  if (elementAtPoint !== element && elementAtPoint !== null) {
    return {
      blocking: true,
      blocker: {
        tag: elementAtPoint.tagName,
        class: elementAtPoint.className,
        zIndex: getComputedStyle(elementAtPoint).zIndex,
        pointerEvents: getComputedStyle(elementAtPoint).pointerEvents
      }
    };
  }
  
  return { blocking: false };
}

// Function to test input interaction
function testInputInteraction() {
  const inputs = document.querySelectorAll('input[type="text"], textarea');
  console.log(`🧪 TESTING ${inputs.length} INPUT FIELDS:`);
  
  inputs.forEach((input, index) => {
    try {
      // Test focus
      input.focus();
      const canFocus = document.activeElement === input;
      
      // Test typing simulation
      const originalValue = input.value;
      input.value = originalValue + 'TEST';
      const canEdit = input.value !== originalValue;
      
      // Restore original value
      input.value = originalValue;
      
      console.log(`  Input ${index + 1}: Focus=${canFocus}, Edit=${canEdit}, Disabled=${input.disabled}, ReadOnly=${input.readOnly}`);
      
      if (!canFocus || !canEdit) {
        console.warn(`    ❌ PROBLEMATIC INPUT:`, {
          element: input,
          computedStyle: {
            pointerEvents: getComputedStyle(input).pointerEvents,
            userSelect: getComputedStyle(input).userSelect,
            zIndex: getComputedStyle(input).zIndex
          },
          overlay: findBlockingOverlay(input)
        });
      }
    } catch (error) {
      console.error(`    ❌ ERROR testing input ${index + 1}:`, error);
    }
  });
}

// Main diagnostic functions
window.captureBeforeDelete = () => {
  beforeState = captureInputState("BEFORE DELETE");
  console.log("✅ Captured BEFORE state. Now perform the delete operation...");
};

window.captureAfterDelete = () => {
  afterState = captureInputState("AFTER DELETE");
  
  console.log("🔍 COMPARISON ANALYSIS:");
  
  // Compare key differences
  if (beforeState.documentOverflow !== afterState.documentOverflow) {
    console.warn("❌ BODY OVERFLOW CHANGED:", beforeState.documentOverflow, "→", afterState.documentOverflow);
  }
  
  // Compare high z-index elements
  const beforeOverlays = beforeState.highZIndexElements?.length || 0;
  const afterOverlays = afterState.highZIndexElements?.length || 0;
  if (beforeOverlays !== afterOverlays) {
    console.warn("❌ HIGH Z-INDEX ELEMENTS CHANGED:", beforeOverlays, "→", afterOverlays);
    console.log("New overlays:", afterState.highZIndexElements?.filter(el => 
      !beforeState.highZIndexElements?.some(before => before.class === el.class)
    ));
  }
  
  // Compare input states
  const beforeInputCount = beforeState.allInputs?.length || 0;
  const afterInputCount = afterState.allInputs?.length || 0;
  if (beforeInputCount !== afterInputCount) {
    console.warn("❌ INPUT COUNT CHANGED:", beforeInputCount, "→", afterInputCount);
  }
  
  // Check for newly disabled/readonly inputs
  afterState.allInputs?.forEach((afterInput, index) => {
    const beforeInput = beforeState.allInputs?.[index];
    if (beforeInput && (
      beforeInput.disabled !== afterInput.disabled ||
      beforeInput.readOnly !== afterInput.readOnly ||
      beforeInput.style.pointerEvents !== afterInput.style.pointerEvents
    )) {
      console.warn(`❌ INPUT ${index + 1} STATE CHANGED:`, {
        before: {
          disabled: beforeInput.disabled,
          readOnly: beforeInput.readOnly,
          pointerEvents: beforeInput.style.pointerEvents
        },
        after: {
          disabled: afterInput.disabled,
          readOnly: afterInput.readOnly,
          pointerEvents: afterInput.style.pointerEvents
        }
      });
    }
  });
  
  console.log("🧪 Running interaction test on current inputs...");
  testInputInteraction();
};

window.quickDiagnostic = () => {
  console.log("🚀 QUICK DIAGNOSTIC:");
  captureInputState("CURRENT");
  testInputInteraction();
};

console.log(`
🔧 DIAGNOSTIC COMMANDS READY:

1. Run BEFORE delete: window.captureBeforeDelete()
2. Run AFTER delete:  window.captureAfterDelete()
3. Quick check:       window.quickDiagnostic()

Or just run: quickDiagnostic() for immediate analysis
`);