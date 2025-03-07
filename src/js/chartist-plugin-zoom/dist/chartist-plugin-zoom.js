(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(["chartist"], function (Chartist) {
      return (root.returnExportsGlobal = factory(Chartist));
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    //module.exports = factory(require("chartist"));
    module.exports = factory(require('../../chartist/dist/chartist'));
  } else {
    root['Chartist.plugins.zoom'] = factory(Chartist);
  }
}(this, function (Chartist) {

  /**
   * Chartist.js zoom plugin.
   *
   */
  (function (window, document, Chartist) {
    'use strict';

    var defaultOptions = {
      // onZoom
      // resetOnRightMouseBtn
      pointClipOffset: 5
    };

    Chartist.plugins = Chartist.plugins || {};
    Chartist.plugins.zoom = function (options) {

      options = Chartist.extend({}, defaultOptions, options);

      return function zoom(chart) {

        if (!(chart instanceof Chartist.Line)) {
          return;
        }

        var rect, svg, axisX, axisY, chartRect;
        var downPosition;
        var onZoom = options.onZoom;
        var ongoingMouseDown = options.ongoingMouseDown;
        var ongoingTouches = [];

        chart.on('draw', function (data) {
          var type = data.type;
          if (type === 'line' || type === 'bar' || type === 'area') {
            data.element.attr({ 'clip-path': 'url(#line-mask)' });
          }
        });

        chart.on('created', function (data) {
          axisX = data.axisX;
          axisY = data.axisY;
          chartRect = data.chartRect;
          svg = data.svg._node;
          rect = data.svg.elem('rect', {
            x: 10,
            y: 10,
            width: 0,           // hide seems not to work so that width and height are changed to zero for choppy
            height: 0,          // hide seems not to work so that width and height are changed to zero for choppy
            opacity: 0.5,
          }, 'ct-zoom-rect');
          hide(rect);

          var defs = data.svg.querySelector('defs') || data.svg.elem('defs');
          var width = chartRect.width();
          var height = chartRect.height();

          function addMask(id, offset) {
            defs
              .elem('clipPath', {
                id: id
              })
              .elem('rect', {
                x: chartRect.x1 - offset,
                y: chartRect.y2 - offset,
                width: width + offset + offset,
                height: height + offset + offset,
                fill: 'white'
              });
          }
          addMask('line-mask', 0);
          addMask('point-mask', options.pointClipOffset);
          var series = chart.svg.querySelectorAll("." + data.options.classNames.series);
          series = series? series.svgElements : [];
          for(var i=0; i < series.length; ++i){
            series[i].attr({'clip-path': 'url(#point-mask)'});
          }

          function on(event, handler) {
            svg.addEventListener(event, handler);
          }

          on('mousedown', onMouseDown);
          on('mouseup', onMouseUp);
          on('mousemove', onMouseMove);
          on('touchstart', onTouchStart);
          on('touchmove', onTouchMove);
          on('touchend', onTouchEnd);
          on('touchcancel', onTouchCancel);
        });



        function copyTouch(touch) {
          var p = position(touch, svg);
          p.id = touch.identifier;
          return p;
        }

        function ongoingTouchIndexById(idToFind) {
          for (var i = 0; i < ongoingTouches.length; i++) {
            var id = ongoingTouches[i].id;
            if (id === idToFind) {
              return i;
            }
          }
          return -1;
        }

        function onTouchStart(event) {
          var touches = event.changedTouches;
          for (var i = 0; i < touches.length; i++) {
            ongoingTouches.push(copyTouch(touches[i]));
          }

          if (ongoingTouches.length > 1) {
            rect.attr(getRect(ongoingTouches[0], ongoingTouches[1]));
            show(rect);
          }
        }

        function onTouchMove(event) {
          var touches = event.changedTouches;
          for (var i = 0; i < touches.length; i++) {
            var idx = ongoingTouchIndexById(touches[i].identifier);
            ongoingTouches.splice(idx, 1, copyTouch(touches[i]));
          }

          if (ongoingTouches.length > 1) {
            rect.attr(getRect(ongoingTouches[0], ongoingTouches[1]));
            show(rect);
            event.preventDefault();
          }
        }

        function onTouchCancel(event) {
          removeTouches(event.changedTouches);
        }

        function removeTouches(touches) {
          for (var i = 0; i < touches.length; i++) {
            var idx = ongoingTouchIndexById(touches[i].identifier);
            if (idx >= 0) {
              ongoingTouches.splice(idx, 1);
            }
          }
        }

        function onTouchEnd(event) {
          if (ongoingTouches.length > 1) {
            zoomIn(getRect(ongoingTouches[0], ongoingTouches[1]));
          }
          removeTouches(event.changedTouches);
          hide(rect);
        }

        function onMouseDown(event) {
          if (event.button === 0) {
            var point = position(event, svg);
            if (isInRect(point, chartRect)) {
              downPosition = point;
              rect.attr(getRect(downPosition, downPosition));
              show(rect);
              event.preventDefault();
              ongoingMouseDown && ongoingMouseDown();
            }
          }
        }

        function isInRect(point, rect) {
          return point.x >= rect.x1 && point.x <= rect.x2 && point.y >= rect.y2 && point.y <= rect.y1;
        }

        var reset = function () {
          chart.options.axisX.highLow = null;
          chart.options.axisY.highLow = null;
          chart.options.showArea = false;  // Added this to show statics for choppy
          chart.update(chart.data, chart.options);
        };

        function onMouseUp(event) {
          if (event.button === 0 && downPosition) {
            var box = getRect(downPosition, position(event, svg));
            zoomIn(box);
            downPosition = null;
            hide(rect);
          }
          else if (options.resetOnRightMouseBtn && event.button === 2) {
            reset();
            event.preventDefault();
          }
        }

        function zoomIn(rect) {
          if (rect.width > 5 && rect.height) {
              var x1 = Math.max(0, rect.x - chartRect.x1);
              var x2 = Math.min(chartRect.width(), x1 + rect.width);
              var y2 = Math.min(chartRect.height(), chartRect.y1 - rect.y);
              var y1 = Math.max(0, y2 - rect.height);

              // Modifled for choppy
              //chart.options.axisX.highLow = { low: project(x1, axisX), high: project(x2, axisX) };
              if(project(x2, axisX) - project(x1, axisX) > 500) {
                chart.options.axisX.highLow = { low: project(x1, axisX), high: project(x2, axisX) };
                chart.options.showArea = true; // Added this to show statics for choppy
              }
              // End of modified for choppy
              //Zoom-in axisX only for choppy
              //chart.options.axisY.highLow = { low: project(y1, axisY), high: project(y2, axisY) };

              
              // chart will be updated in onZoom function for choppy
              //chart.update(chart.data, chart.options);
              onZoom && onZoom(chart, reset);
            }
        }

        function onMouseMove(event) {
          if (downPosition) {
            var point = position(event, svg);
            if (isInRect(point, chartRect)) {
              rect.attr(getRect(downPosition, point));
              event.preventDefault();
            }
          }
        }
      };

    };

    function hide(rect) {
      // Modified for choppy because this causes error
      //rect.attr({ style: 'display:none' });
    }

    function show(rect) {
      // Modified for choppy because this causes error
      //rect.attr({ style: 'display:block' });
    }

    function getRect(firstPoint, secondPoint) {
      var x = firstPoint.x;
      var y = firstPoint.y;
      var width = secondPoint.x - x;
      var height = secondPoint.y - y;
      if (width < 0) {
        width = -width;
        x = secondPoint.x;
      }
      if (height < 0) {
        height = -height;
        y = secondPoint.y;
      }
      return {
        x: x,
        //y: 0,            // Zoom-in axisX only for choppy
        y: 15,
        width: width,
        //height: height   // Zoom-in axisX only for choppy
        height: 350
      };
    }

    function position(event, svg) {
      return transform(event.clientX, event.clientY, svg);
    }

    function transform(x, y, svgElement) {
      var svg = svgElement.tagName === 'svg' ? svgElement : svgElement.ownerSVGElement;
      var matrix = svg.getScreenCTM();
      var point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      point = point.matrixTransform(matrix.inverse());
      return point || { x: 0, y: 0 };
    }

    function project(value, axis) {
      var bounds = axis.bounds || axis.range;
      var max = bounds.max;
      var min = bounds.min;
      if (axis.scale && axis.scale.type === 'log') {
        var base = axis.scale.base;
        return Math.pow(base,
          value * baseLog(max / min, base) / axis.axisLength) * min;
      }
      var range = bounds.range || (max - min);
      return (value * range / axis.axisLength) + min;
    }

    function baseLog(val, base) {
      return Math.log(val) / Math.log(base);
    }

  } (window, document, Chartist));

  return Chartist.plugins.zoom;

}));
