/// <reference types="vite/client" />

declare module 'scrollama' {
  export interface StepEvent {
    element: HTMLElement;
    index: number;
    direction: 'up' | 'down';
  }
  export interface ScrollamaInstance {
    setup(opts: {
      step: string | HTMLElement[] | NodeListOf<Element>;
      offset?: number;
      progress?: boolean;
      once?: boolean;
      debug?: boolean;
    }): ScrollamaInstance;
    onStepEnter(cb: (e: StepEvent) => void): ScrollamaInstance;
    onStepExit(cb: (e: StepEvent) => void): ScrollamaInstance;
    onStepProgress(cb: (e: StepEvent & { progress: number }) => void): ScrollamaInstance;
    resize(): ScrollamaInstance;
    destroy(): void;
  }
  export default function scrollama(): ScrollamaInstance;
}
