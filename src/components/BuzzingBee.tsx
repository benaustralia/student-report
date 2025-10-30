import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface BuzzingBeeProps {
  className?: string;
}

export function BuzzingBee({ className = '' }: BuzzingBeeProps) {
  const beeContainerRef = useRef<HTMLDivElement>(null);
  const leftWingRef = useRef<SVGPathElement>(null);
  const rightWingRef = useRef<SVGPathElement>(null);
  const leftEyeRef = useRef<SVGEllipseElement>(null);
  const rightEyeRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    if (!beeContainerRef.current || !leftWingRef.current || !rightWingRef.current || 
        !leftEyeRef.current || !rightEyeRef.current) return;

    const bee = beeContainerRef.current;
    const leftWing = leftWingRef.current;
    const rightWing = rightWingRef.current;
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;

    // Slow, gentle continuous wing flapping
    gsap.to(leftWing, {
      rotation: -15,
      transformOrigin: "right center",
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    gsap.to(rightWing, {
      rotation: 15,
      transformOrigin: "left center",
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // Scroll-triggered buzzing - constrained to left margin with vertical movement
    gsap.to(bee, {
      y: () => window.innerHeight * 0.3,
      x: 8,
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "25% top",
        scrub: 1
      },
      ease: "sine.inOut"
    });

    gsap.to(bee, {
      y: () => window.innerHeight * 0.6,
      x: -8,
      scrollTrigger: {
        trigger: "body",
        start: "25% top",
        end: "50% top",
        scrub: 1
      },
      ease: "sine.inOut"
    });

    gsap.to(bee, {
      y: () => window.innerHeight * 0.9,
      x: 10,
      scrollTrigger: {
        trigger: "body",
        start: "50% top",
        end: "75% top",
        scrub: 1
      },
      ease: "sine.inOut"
    });

    gsap.to(bee, {
      y: () => window.innerHeight * 1.2,
      x: 0,
      scrollTrigger: {
        trigger: "body",
        start: "75% top",
        end: "bottom bottom",
        scrub: 1
      },
      ease: "sine.inOut"
    });

    // Rotation while scrolling
    gsap.to(bee, {
      rotation: 360,
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: 2
      },
      ease: "none"
    });

    // Eye bulging on scroll - returns to normal at end
    gsap.to([leftEye, rightEye], {
      attr: {
        rx: 1.3,
        ry: 1.3
      },
      scrollTrigger: {
        trigger: "body",
        start: "20% top",
        end: "40% top",
        scrub: 0.5
      },
      ease: "sine.inOut"
    });

    gsap.to([leftEye, rightEye], {
      attr: {
        rx: 1.5,
        ry: 1.5
      },
      scrollTrigger: {
        trigger: "body",
        start: "40% top",
        end: "60% top",
        scrub: 0.5
      },
      ease: "sine.inOut"
    });

    gsap.to([leftEye, rightEye], {
      attr: {
        rx: 0.82,
        ry: 0.82
      },
      scrollTrigger: {
        trigger: "body",
        start: "60% top",
        end: "bottom bottom",
        scrub: 0.5
      },
      ease: "sine.inOut"
    });

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, []);

  return (
    <div 
      ref={beeContainerRef}
      className={`fixed top-[20%] left-[15px] w-[90px] h-[90px] z-[100] pointer-events-none ${className}`}
    >
      <svg viewBox="-5 -2 41.4 22.02" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-[2px_2px_4px_rgba(0,0,0,0.2)] overflow-visible">
        <path 
          ref={rightWingRef}
          fill="#eec93a" 
          d="M27.52.18c.99-.35,2.61-.24,2.59.89.03.64-.08,1.37.53,1.77,2.23,1.35-1.07,3.05-1.89,4.16-.1.18-.03.3.17.4.38.19,1.09.38,1.13.84.04.33-.17.71-.4,1-1.56,1.79-4.85,3.03-6.86,3.69-.44.12-.88.12-.77-.47.79-2.03,1.32-3.81,1.33-6.08.06-.77,0-1.58.38-2.26.9-1.17,2.34-3.2,3.65-3.87"
        />
        <path 
          ref={leftWingRef}
          fill="#eec93a" 
          d="M5.47,9.47c5.82-.22,4.17,3.95,11.01,5.76-1.99,1.4-11.89,5.24-10.05.48-2.62,1.32-4.66-.87-1.91-2.64-7.56,1.28-4.47-3.49.96-3.6Z"
        />
        <path 
          fill="#e12e4e" 
          d="M23.52,4.49c-1.45-2.75-5.45-4.88-7.26-1.71-.42.67-.9,1.53-1.79,1.19-2.29-1.23-3.47.17-4.78,1.95-2.55,4.46,2.51,7.88,6.36,9.26,1.35.43,3.2,2.16,4.46.79,2.07-3.17,3.59-7.56,3.06-11.31l-.06-.17ZM19.27,5.9c1-.25,1.45,1.36.39,1.62-1,.25-1.46-1.36-.39-1.62ZM13.21,9.92c-1.57.52-1.64-1.37-.64-1.62.92-.23,1.48,1.34.64,1.62ZM15.71,12.73c-.35-.49-.77-.89-.87-1.37.03-.17.35-.1.87-.07.88.13,2.43-.23,3.28-.9.41-.29.84-.76,1.26-1.09.72,2.26-2.21,5.56-4.45,3.53l-.1-.1Z"
        />
        <ellipse 
          ref={leftEyeRef}
          fill="#0f0f0f" 
          cx="12.89" 
          cy="9.1" 
          rx="0.82" 
          ry="0.82"
        />
        <ellipse 
          ref={rightEyeRef}
          fill="#0f0f0f" 
          cx="19.47" 
          cy="6.71" 
          rx="0.82" 
          ry="0.82"
        />
        <path 
          fill="#f29288" 
          d="M15.71,12.73c-.35-.49-.77-.89-.87-1.37.03-.17.35-.1.87-.07.88.13,2.43-.23,3.28-.9.41-.29.84-.76,1.26-1.09.72,2.26-2.21,5.56-4.45,3.53l-.1-.1Z"
        />
      </svg>
    </div>
  );
}