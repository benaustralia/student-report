import React from 'react';
import { BuzzingBee } from './BuzzingBee';

export const BuzzingBeeDemo: React.FC = () => {
  return (
    <div className="min-h-[400vh] bg-transparent pb-[200px] overflow-x-hidden">
      <BuzzingBee />
      
      <div className="pt-[50vh] px-5 max-w-[800px] mx-auto ml-[200px] text-[#333] font-sans">
        <h1 className="text-[3em] mt-[100vh] mb-[50px] text-center text-[#0f0f0f]">
          🌻 Scroll to See the Bee Buzz! 🌻
        </h1>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          Keep scrolling down...
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          The bee is getting excited!
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          Look at those wings flap!
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          And those eyes bulge!
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          Keep going...
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          Almost there...
        </p>
        
        <p className="text-[1.5em] leading-[1.8] my-[60vh] text-center">
          🌸 Happy buzzing! 🌸
        </p>
      </div>
    </div>
  );
};
