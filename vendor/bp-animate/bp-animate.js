/**
 * BP Animate Library
 * 
 * A lightweight animation library that adds animation triggers when elements
 * come into view. The base class "bp-animate" doesn't start animations itself,
 * but triggers the "bp-is-animating" class when elements enter the viewport.
 * When the animation completes, it adds the "bp-is-done-animating" class.
 * 
 * @version 1.2.2
 */

(function() {
    'use strict';

    /**
     * Get animation attributes from element
     * 
     * Reads custom animation attributes (bp-duration, bp-delay, bp-easing)
     * from the element. Returns null if no custom attributes are provided.
     * 
     * @param {HTMLElement} element - The element to read attributes from
     * @returns {Object|null} Object containing duration, delay, and easing values, or null
     * @since 1.0.0
     */
    function getAnimationAttributes(element) {
        // Check if any custom attributes are provided
        const hasDuration = element.hasAttribute('bp-duration');
        const hasDelay = element.hasAttribute('bp-delay');
        const hasEasing = element.hasAttribute('bp-easing');
        
        // If no custom attributes, return null to use CSS defaults
        if (!hasDuration && !hasDelay && !hasEasing) {
            return null;
        }
        
        // Get duration (default: 0.6s if attribute exists but is empty)
        const duration = hasDuration ? (element.getAttribute('bp-duration') || '0.6s') : '0.6s';
        
        // Get delay (default: 0s if attribute exists but is empty)
        const delay = hasDelay ? (element.getAttribute('bp-delay') || '0s') : '0s';
        
        // Get easing (default: ease-in-out if attribute exists but is empty)
        const easing = hasEasing ? (element.getAttribute('bp-easing') || 'ease-in-out') : 'ease-in-out';
        
        return {
            duration: duration,
            delay: delay,
            easing: easing
        };
    }

    /**
     * Get keyframe name from animation class
     * 
     * Maps animation class names to their corresponding keyframe names.
     * 
     * @param {HTMLElement} element - The element to check for animation classes
     * @returns {string|null} The keyframe name or null if no animation class found
     * @since 1.0.0
     */
    function getKeyframeName(element) {
        // Map of animation classes to their keyframe names
        const animationMap = {
            'fade-in': 'bpFadeIn',
            'fade-out': 'bpFadeOut',
            'fade-up': 'bpFadeUp',
            'fade-down': 'bpFadeDown',
            'slide-left': 'bpSlideLeft',
            'slide-right': 'bpSlideRight',
            'slide-up': 'bpSlideUp',
            'slide-down': 'bpSlideDown',
            'scale-up': 'bpScaleUp',
            'scale-down': 'bpScaleDown',
            'zoom-in': 'bpZoomIn',
            'zoom-out': 'bpZoomOut',
            'rotate-in': 'bpRotateIn',
            'rotate-in-left': 'bpRotateInLeft',
            'rotate-in-right': 'bpRotateInRight',
            'bounce': 'bpBounce',
            'bounce-in': 'bpBounceIn',
            'bounce-up': 'bpBounceUp',
            'bounce-down': 'bpBounceDown',
            'flip-x': 'bpFlipX',
            'flip-y': 'bpFlipY',
            'spin': 'bpSpin',
            'elastic': 'bpElastic',
            'slide-fade-up': 'bpSlideFadeUp',
            'slide-fade-down': 'bpSlideFadeDown',
            'slide-fade-left': 'bpSlideFadeLeft',
            'slide-fade-right': 'bpSlideFadeRight',
            'card': 'bpCard',
            'done-demo': 'bpDoneDemo'
        };

        // Check each class on the element to find a matching animation class
        for (let className of element.classList) {
            if (animationMap.hasOwnProperty(className)) {
                return animationMap[className];
            }
        }

        return null;
    }

    /**
     * Apply animation styles to element
     * 
     * Applies custom duration, delay, and easing to the element
     * by setting the animation property directly via inline styles.
     * 
     * @param {HTMLElement} element - The element to apply styles to
     * @param {Object} attributes - Animation attributes object
     * @since 1.0.0
     */
    function applyAnimationStyles(element, attributes) {
        // Get the keyframe name for this element's animation class
        const keyframeName = getKeyframeName(element);
        
        if (keyframeName) {
            // Build the animation property: name duration easing delay fill-mode
            // Using 'forwards' to keep the final state after animation completes
            const animationValue = `${keyframeName} ${attributes.duration} ${attributes.easing} ${attributes.delay} forwards`;
            element.style.animation = animationValue;
        }
    }

    /**
     * Check if element is actually visible
     * 
     * Checks if an element is truly visible, not just in the viewport.
     * An element is considered visible if:
     * - It has dimensions (width and height > 0)
     * - It's not display: none
     * - It's not visibility: hidden
     * - It has opacity > 0 OR has animation classes AND is not intentionally hidden
     * 
     * This prevents triggering animations on elements that are intentionally hidden
     * via opacity: 0 but are not part of an animation sequence.
     * 
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} True if element is visible, false otherwise
     * @since 1.0.0
     */
    function isElementVisible(element) {
        // Get computed styles
        const style = window.getComputedStyle(element);
        
        // Check if element is hidden via display
        if (style.display === 'none') {
            return false;
        }
        
        // Check if element is hidden via visibility
        if (style.visibility === 'hidden') {
            return false;
        }
        
        // Check if element has dimensions
        const rect = element.getBoundingClientRect();
        
        // Check if element has a valid animation class (predefined or custom)
        // Custom animation classes often start with "animation-" prefix
        const hasAnimationClass = getKeyframeName(element) !== null;
        const hasCustomAnimationClass = Array.from(element.classList).some(className => 
            className.startsWith('animation-') || 
            className.includes('animate') ||
            className.includes('grow') ||
            className.includes('slide') ||
            className.includes('fade') ||
            className.includes('scale') ||
            className.includes('rotate') ||
            className.includes('bounce') ||
            className.includes('flip')
        );
        
        // If element has zero dimensions, check if it has an animation class
        // Animations like growWidth, scale-up, etc. may intentionally start from zero
        if (rect.width === 0 && rect.height === 0) {
            // Allow zero dimensions if element has an animation class (predefined or custom)
            // The animation will handle making it visible
            if (hasAnimationClass || hasCustomAnimationClass) {
                // Element has animation class and zero dimensions - this is likely intentional
                // (e.g., animation-growWidth starts from width: 0)
                // Continue with visibility check
            } else {
                // No animation class and zero dimensions - element is truly hidden
                return false;
            }
        }
        
        // Check opacity
        const opacity = parseFloat(style.opacity);
        
        // If opacity is 0, we need to be more careful
        if (opacity === 0) {
            // Check if element has a valid animation class
            const hasAnimationClass = getKeyframeName(element) !== null;
            
            // If it doesn't have a valid animation class, it's intentionally hidden
            if (!hasAnimationClass) {
                return false;
            }
            
            // Element has opacity 0 and an animation class
            // Check if opacity is set via inline style (intentional hiding)
            const inlineOpacity = element.style.opacity;
            if (inlineOpacity === '0' || inlineOpacity === '0px') {
                // Opacity is explicitly set to 0 via inline style - this is intentional hiding
                // Even if it has an animation class, don't trigger if opacity is explicitly 0
                return false;
            }
            
            // Check if element has position fixed/absolute
            // Fixed/absolute elements with opacity 0 are often intentionally hidden (like menus)
            // Only trigger if explicitly allowed via data attribute
            const position = style.position;
            if ((position === 'fixed' || position === 'absolute') && opacity === 0) {
                // For fixed/absolute elements with opacity 0, require explicit permission
                // This prevents menus and other hidden fixed elements from auto-triggering
                if (!element.hasAttribute('data-bp-allow-hidden-animate')) {
                    return false;
                }
            }
            
            // Element has opacity 0 but has a valid animation class and passes other checks
            // Opacity 0 is the initial state for fade-in, slide, etc. animations
            return true;
        }
        
        // Element has opacity > 0, so it's visible
        return true;
    }

    /**
     * Handle animation completion
     * 
     * This function listens for transitionend and animationend events
     * to detect when CSS animations/transitions are complete.
     * When complete, it adds the "bp-is-done-animating" class.
     * 
     * @param {HTMLElement} element - The element that is animating
     * @since 1.0.0
     */
    function handleAnimationComplete(element) {
        // Track if we've already added the done class for this animation cycle
        // This prevents multiple triggers if there are multiple transitions
        let isDone = false;

        /**
         * Function to add the done class (only once per animation cycle)
         */
        function addDoneClass() {
            if (!isDone) {
                isDone = true;
                element.classList.add('bp-is-done-animating');
            }
        }

        // Listen for CSS transition end events
        // This fires when any CSS transition property finishes animating
        element.addEventListener('transitionend', function(event) {
            // Only handle transitions on the element itself, not child elements
            if (event.target === element) {
                addDoneClass();
            }
        }, { once: true }); // { once: true } removes listener after first trigger

        // Listen for CSS animation end events
        // This fires when any CSS animation finishes
        element.addEventListener('animationend', function(event) {
            // Only handle animations on the element itself, not child elements
            if (event.target === element) {
                addDoneClass();
            }
        }, { once: true }); // { once: true } removes listener after first trigger
    }

    /**
     * Initialize the BP Animate library
     * 
     * This function sets up an Intersection Observer to watch for elements
     * with the "bp-animate" class. When these elements come into view,
     * it adds the "bp-is-animating" class to trigger animations.
     * When animations complete, it adds the "bp-is-done-animating" class.
     * 
     * @since 1.0.0
     */
    function initBPAnimate() {
        // Get all elements with the bp-animate class
        const animateElements = document.querySelectorAll('.bp-animate');

        // If no elements found, exit early
        if (animateElements.length === 0) {
            return;
        }

        /**
         * Intersection Observer options
         * 
         * root: null means we're observing relative to the viewport
         * rootMargin: '0px' means no offset (you can adjust this to trigger earlier/later)
         * threshold: 0 means trigger when any part of the element enters the viewport
         */
        const observerOptions = {
            root: null,           // Viewport is the root
            rootMargin: '0px',    // No margin offset
            threshold: 0          // Trigger when element is 0% visible
        };

        /**
         * Callback function that runs when observed elements intersect with the viewport
         * 
         * @param {IntersectionObserverEntry[]} entries - Array of intersection entries
         * @param {IntersectionObserver} observer - The observer instance
         */
        function handleIntersection(entries, observer) {
            entries.forEach(entry => {
                // Check if the element is currently intersecting (visible in viewport)
                if (entry.isIntersecting) {
                    const element = entry.target;
                    
                    // Check if element is actually visible
                    const isVisible = isElementVisible(element);
                    
                    if (isVisible) {
                        // Element is in viewport AND actually visible
                        // Remove hidden class if it exists
                        element.classList.remove('bp-is-hidden');
                        
                        // Always add bp-is-visible class when element is in viewport and visible
                        // This works for elements with or without animation classes
                        element.classList.add('bp-is-visible');
                        
                        // Check if element has an animation class
                        // Only trigger animation if element has a valid animation class
                        const hasAnimationClass = getKeyframeName(element) !== null;
                        
                        if (hasAnimationClass) {
                            // Get animation attributes (duration, delay, easing)
                            // Returns null if no custom attributes are provided
                            const attributes = getAnimationAttributes(element);
                            
                            // Apply animation styles only if custom attributes are provided
                            if (attributes !== null) {
                                applyAnimationStyles(element, attributes);
                            }
                            
                            // Remove done class if it exists (for re-animations)
                            element.classList.remove('bp-is-done-animating');
                            
                            // Add the bp-is-animating class to trigger the animation
                            element.classList.add('bp-is-animating');
                            
                            // Set up listeners to detect when animation completes
                            handleAnimationComplete(element);
                            
                            // Check if animation should only run once
                            const animationOnce = element.getAttribute('bp-animation-once');
                            if (animationOnce === 'true') {
                                // Unobserve the element to prevent re-triggering
                                observer.unobserve(element);
                            }
                        }
                    } else {
                        // Element is in viewport but NOT actually visible (hidden via CSS)
                        // Remove visible class if it exists
                        element.classList.remove('bp-is-visible');
                        
                        // Add bp-is-hidden class to indicate element is in viewport but hidden
                        element.classList.add('bp-is-hidden');
                    }
                } else {
                    const element = entry.target;
                    // Remove all state classes when element leaves viewport
                    element.classList.remove('bp-is-animating');
                    element.classList.remove('bp-is-visible');
                    element.classList.remove('bp-is-hidden');
                    // Clear inline animation style when element leaves view
                    // This allows CSS defaults to work if element re-enters without custom attributes
                    element.style.animation = '';
                }
            });
        }

        // Create a new Intersection Observer instance
        const observer = new IntersectionObserver(handleIntersection, observerOptions);

        // Start observing each element with the bp-animate class
        animateElements.forEach(element => {
            observer.observe(element);
        });
        
        // Store observer globally so we can add new elements to it later
        window._bpAnimateObserver = observer;
        
        return observer;
    }
    
    /**
     * Observe a new element that was dynamically added to the DOM
     * 
     * This function adds a new element to the Intersection Observer
     * and sets up visibility change watching for dynamically added elements.
     * 
     * @param {HTMLElement} element - The element to observe
     * @since 1.2.1
     */
    function observeNewElement(element) {
        // Check if element has bp-animate class
        if (!element.classList.contains('bp-animate')) {
            return;
        }
        
        // Check if element is already being observed
        if (element.dataset.bpObserved === 'true') {
            return;
        }
        
        // Mark as observed
        element.dataset.bpObserved = 'true';
        
        // Get or create the observer
        let observer = window._bpAnimateObserver;
        
        if (!observer) {
            // Observer doesn't exist yet, initialize it
            initBPAnimate();
            observer = window._bpAnimateObserver;
        }
        
        if (observer) {
            // Add element to Intersection Observer
            observer.observe(element);
            
            // Set up visibility change watching
            watchForVisibilityChanges([element]);
            
            // If element is already in viewport, trigger check immediately
            const rect = element.getBoundingClientRect();
            const isInViewport = rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
                                rect.bottom > 0 &&
                                rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
                                rect.right > 0;
            
            if (isInViewport) {
                // Small delay to ensure CSS is applied
                setTimeout(function() {
                    triggerAnimation(element);
                }, 50);
            }
        }
    }
    
    /**
     * Watch for dynamically added elements with bp-animate class
     * 
     * Sets up a MutationObserver to watch the entire document for new elements
     * being added that have the bp-animate class.
     * 
     * @since 1.2.1
     */
    function watchForNewElements() {
        // Create a MutationObserver to watch for new elements
        const domObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // Check for newly added nodes
                mutation.addedNodes.forEach(function(node) {
                    // Only process element nodes
                    if (node.nodeType === 1) { // Element node
                        // Check if the node itself has bp-animate class
                        if (node.classList && node.classList.contains('bp-animate')) {
                            observeNewElement(node);
                        }
                        
                        // Also check for bp-animate elements within the added node
                        const bpAnimateElements = node.querySelectorAll && node.querySelectorAll('.bp-animate');
                        if (bpAnimateElements) {
                            bpAnimateElements.forEach(function(element) {
                                observeNewElement(element);
                            });
                        }
                    }
                });
            });
        });
        
        // Start observing the document body for child additions
        domObserver.observe(document.body, {
            childList: true,    // Watch for added/removed children
            subtree: true       // Watch all descendants, not just direct children
        });
        
        // Store observer so it persists
        window._bpAnimateDOMObserver = domObserver;
    }

    /**
     * Manually trigger animation for an element
     * 
     * This function allows you to manually trigger an animation on an element,
     * useful when elements become visible dynamically via class or CSS changes.
     * 
     * @param {HTMLElement|string} element - The element or selector to trigger animation on
     * @returns {boolean} True if animation was triggered, false otherwise
     * @since 1.1.0
     */
    function triggerAnimation(element) {
        // Get element if selector string provided
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        // Check if element exists and has bp-animate class
        if (!element || !element.classList.contains('bp-animate')) {
            return false;
        }
        
        // Check if element is actually visible now
        const isVisible = isElementVisible(element);
        
        if (isVisible) {
            // Element is visible - add bp-is-visible, remove bp-is-hidden
            element.classList.remove('bp-is-hidden');
            element.classList.add('bp-is-visible');
            
            // Check if element has an animation class
            const hasAnimationClass = getKeyframeName(element) !== null;
            
            if (hasAnimationClass) {
                // Get animation attributes
                const attributes = getAnimationAttributes(element);
                
                // Apply animation styles if custom attributes provided
                if (attributes !== null) {
                    applyAnimationStyles(element, attributes);
                }
                
                // Remove done class if it exists (for re-animations)
                element.classList.remove('bp-is-done-animating');
                
                // Add the bp-is-animating class to trigger the animation
                element.classList.add('bp-is-animating');
                
                // Set up listeners to detect when animation completes
                handleAnimationComplete(element);
            }
            
            return true;
        } else {
            // Element is in viewport but not visible - add bp-is-hidden
            element.classList.remove('bp-is-visible');
            element.classList.add('bp-is-hidden');
            return false;
        }
    }

    /**
     * Watch for dynamic visibility changes
     * 
     * Sets up a MutationObserver to watch for class and style changes
     * that might make elements visible, and triggers animations accordingly.
     * 
     * @param {HTMLElement[]} elements - Array of elements to watch
     * @since 1.1.0
     */
    function watchForVisibilityChanges(elements) {
        elements.forEach(element => {
            // Only watch elements that haven't been observed yet
            if (element.dataset.bpWatched === 'true') {
                return;
            }
            
            element.dataset.bpWatched = 'true';
            
            // Watch for class and style attribute changes
            const observer = new MutationObserver(function(mutations) {
                let shouldCheck = false;
                
                mutations.forEach(function(mutation) {
                    // Check if class or style changed
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        shouldCheck = true;
                    }
                });
                
                // If relevant changes occurred, check if element is now visible
                if (shouldCheck) {
                    // Small delay to allow CSS to update
                    setTimeout(function() {
                        // Only trigger if element is not already animating
                        if (!element.classList.contains('bp-is-animating') && 
                            !element.classList.contains('bp-is-done-animating')) {
                            
                            // Check if element is now visible
                            if (isElementVisible(element)) {
                                // Check if element is in viewport
                                const rect = element.getBoundingClientRect();
                                const isInViewport = rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
                                                    rect.bottom > 0 &&
                                                    rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
                                                    rect.right > 0;
                                
                                if (isInViewport) {
                                    // Trigger animation/visibility detection
                                    // This will add bp-is-visible or bp-is-hidden as appropriate
                                    triggerAnimation(element);
                                }
                            }
                        }
                    }, 50);
                }
            });
            
            observer.observe(element, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        });
    }

    /**
     * Initialize when DOM is ready
     * 
     * We wait for the DOM to be fully loaded before initializing.
     * This ensures all elements with .bp-animate are available.
     */
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded event
        document.addEventListener('DOMContentLoaded', function() {
            initBPAnimate();
            // Watch for dynamic visibility changes
            const animateElements = document.querySelectorAll('.bp-animate');
            watchForVisibilityChanges(Array.from(animateElements));
            // Watch for dynamically added elements
            watchForNewElements();
        });
    } else {
        // DOM is already loaded, initialize immediately
        initBPAnimate();
        // Watch for dynamic visibility changes
        const animateElements = document.querySelectorAll('.bp-animate');
        watchForVisibilityChanges(Array.from(animateElements));
        // Watch for dynamically added elements
        watchForNewElements();
    }

    // Expose public API
    window.bpAnimate = {
        trigger: triggerAnimation,
        init: initBPAnimate,
        observe: observeNewElement
    };

})();

