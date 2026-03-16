import React, { useEffect, useRef } from 'react';

const VegaChart = ({ spec, title }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !spec || !window.vegaEmbed) return;

    let vegaView = null;
    let timeoutId = null;

    const renderChart = () => {
      // Clean up previous view if it exists
      if (vegaView) {
        vegaView.finalize();
      }

      const { title: specTitle, ...specWithoutTitle } = spec;

      // Calculate width based on container, with safety fallback
      const containerWidth = chartRef.current.parentElement?.clientWidth || 400;
      const effectiveWidth = Math.max(containerWidth - 40, 200); // 40px for padding/safety

      const options = {
        actions: false,
        renderer: 'svg',
        background: '#000000',
        padding: { left: 10, right: 30, top: 10, bottom: 10 }
      };

      const modifiedSpec = {
        ...specWithoutTitle,
        background: '#000000',
        width: effectiveWidth,
        height: 250,
        autosize: { type: 'fit', contains: 'padding' },
        config: {
          ...spec.config,
          background: '#000000',
          view: { 
            stroke: 'transparent', 
            fill: '#000000' 
          },
          axis: {
            gridColor: 'rgba(255,255,255,0.05)',
            domainColor: 'rgba(255, 255, 255, 0.36)',
            tickColor: 'rgba(255,255,255,0.2)',
            labelColor: 'rgba(255,255,255,0.6)',
            titleColor: 'rgba(255,255,255,0.8)',
            labelFontSize: 11,
            titleFontSize: 12,
            labelPadding: 8
          },
          legend: {
            labelColor: 'rgba(255,255,255,0.6)',
            titleColor: 'rgba(255,255,255,0.8)'
          }
        }
      };

      window.vegaEmbed(chartRef.current, modifiedSpec, options)
        .then(result => {
          vegaView = result.view;
        })
        .catch(err => {
          console.error("Vega rendering error:", err);
        });
    };

    // Initial render
    renderChart();

    // Observe the parent container for more reliable sizing
    const resizeObserver = new ResizeObserver(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        renderChart();
      }, 100); // Debounce to prevent excessive re-renders during drag
    });

    if (chartRef.current.parentElement) {
      resizeObserver.observe(chartRef.current.parentElement);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      if (vegaView) vegaView.finalize();
    };
  }, [spec]);

  // Robust title check
  const displayTitle = title || "";

  return (
    <div className="vega-chart-container mt-4 p-4 bg-black rounded-2xl border border-white/10 shadow-2xl w-full min-h-[350px]" style={{ backgroundColor: '#000000' }}>
      {displayTitle.length > 0 && <h4 className="text-[27px] font-bold text-white mb-6 pr-4 block relative z-10" style={{ paddingLeft: '20px', paddingTop: '10px' }}>{displayTitle}</h4>}
      <div ref={chartRef} className="w-full relative" style={{ backgroundColor: '#000000', minHeight: '250px' }}></div>
    </div>
  );
};

export default VegaChart;
