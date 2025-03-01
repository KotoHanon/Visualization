function detectAndHandleBinding(controlPoint,lineShape,endpointIndex){
    const threshold=10;
    let bound=false;

    // 获取当前控制点(全局坐标)
    const cpX=parseFloat(controlPoint.attr("cx")||controlPoint.attr("x")||0);
    const cpY=parseFloat(controlPoint.attr("cy")||controlPoint.attr("y")||0);

    // 遍历所有 g 形状
    svg.selectAll("g").each(function(){
      const otherShape=d3.select(this);
      if(otherShape.node()===lineShape.node()) return;

      // 动态计算 otherShape 的 8 个锚点(4顶点+4中点)在全局坐标下
      const anchorPoints = computeGlobalAnchorPoints(otherShape);
      for(let i=0; i<anchorPoints.length;i++){
        const ax=anchorPoints[i][0];
        const ay=anchorPoints[i][1];
        const distance=Math.hypot(cpX-ax, cpY-ay);
        if(distance<=threshold){
          lineShape.classed("highlighted",true);
          otherShape.classed("highlighted",true);

          const existingBinding=bindings.findIndex(b=>
            b.line.node()===lineShape.node() && b.endpointIndex===endpointIndex
          );
          if(existingBinding!==-1){
            bindings[existingBinding]={
              line:lineShape,
              endpointIndex:endpointIndex,
              shape:otherShape,
              anchorIndex:i
            };
          } else {
            bindings.push({
              line:lineShape,
              endpointIndex:endpointIndex,
              shape:otherShape,
              anchorIndex:i
            });
          }
          bound=true;
          break;
        }
      }
    });

    if(!bound){
      const existingBinding=bindings.findIndex(b=>
        b.line.node()===lineShape.node() && b.endpointIndex===endpointIndex
      );
      if(existingBinding!==-1){
        bindings.splice(existingBinding,1);
      }
    }
  }

  // 计算图形的 8 个锚点(4顶点+4中点)在全局坐标
  function computeGlobalAnchorPoints(shape){
    const transform=shape.attr("data-transform")||"";
    const tData=parseTransform(transform);
    const matrix=shape.node().getCTM();
    const bbox=shape.node().getBBox();
    const corners=[
      [bbox.x,bbox.y],
      [bbox.x+bbox.width,bbox.y],
      [bbox.x+bbox.width,bbox.y+bbox.height],
      [bbox.x,bbox.y+bbox.height]
    ].map(([x,y])=>{
      const p=svg.node().createSVGPoint();
      p.x=x;p.y=y;
      return [p.matrixTransform(matrix).x,p.matrixTransform(matrix).y];
    });
    const midpoints=[
      [(corners[0][0]+corners[1][0])/2,(corners[0][1]+corners[1][1])/2],
      [(corners[1][0]+corners[2][0])/2,(corners[1][1]+corners[2][1])/2],
      [(corners[2][0]+corners[3][0])/2,(corners[2][1]+corners[3][1])/2],
      [(corners[3][0]+corners[0][0])/2,(corners[3][1]+corners[0][1])/2]
    ];
    return [...corners, ...midpoints];
  }

  function updateBindings(){
    bindings.forEach(binding=>{
      const { line, endpointIndex, shape, anchorIndex }=binding;

      // 重新计算 shape 的 8个锚点
      const anchorPoints=computeGlobalAnchorPoints(shape);
      if(anchorIndex<anchorPoints.length){
        const anchorPos=anchorPoints[anchorIndex];
        // 把 anchorPos 转换到 line 的局部坐标
        const inverseMatrix=line.node().getCTM().inverse();
        const localPoint=svg.node().createSVGPoint();
        localPoint.x=anchorPos[0];
        localPoint.y=anchorPos[1];
        const transformedPoint=localPoint.matrixTransform(inverseMatrix);

        if(line.attr("data-type")==="polyline-arrow"){
          const polyline=line.select("polyline");
          if(!polyline.empty()){
            const pointsData=JSON.parse(polyline.attr("data-points"));
            if(endpointIndex < pointsData.length){
              pointsData[endpointIndex]=[transformedPoint.x, transformedPoint.y];
              polyline
                .attr("data-points",JSON.stringify(pointsData))
                .attr("points",pointsData.map(d=>d.join(",")).join(" "));
              const arrow=line.select("polygon[data-endpoint]");
              const lastPt=pointsData[pointsData.length-1];
              arrow.attr("data-endpoint",`${lastPt[0]},${lastPt[1]}`);
              const arrowCoords=computeArrowCoords(lastPt,pointsData[pointsData.length-2]);
              arrow.attr("points",arrowCoords.points)
                   .attr("transform",`translate(${lastPt[0]},${lastPt[1]}) rotate(${arrowCoords.angle})`);
            }
          }
        } else {
          // line
          const lineElement=line.select("line");
          if(!lineElement.empty()){
            if(endpointIndex===0){
              lineElement.attr("x1",transformedPoint.x).attr("y1",transformedPoint.y);
            } else {
              lineElement.attr("x2",transformedPoint.x).attr("y2",transformedPoint.y);
            }
          }
        }
      }
    });
  }

  function removeBindingsForShape(shape){
    const node=shape.node();
    for(let i=bindings.length-1;i>=0;i--){
      const b=bindings[i];
      if(b.line.node()===node || b.shape.node()===node){
        bindings.splice(i,1);
      }
    }
    shape.classed("highlighted",false);
    shape.classed("flow-highlighted", false); // 移除流动高光
  }

  // 多选框 (marquee)
  let marqueeRect=null;
  let startPos=null;
  svg.on("mousedown",function(event){
    if(event.target.tagName==='svg'){
      startPos=d3.pointer(event,svg.node());
      marqueeRect=svg.append("rect")
        .attr("class","marquee")
        .attr("x",startPos[0])
        .attr("y",startPos[1])
        .attr("width",0)
        .attr("height",0);
      event.preventDefault();
    }
  })
  .on("mousemove",function(event){
    if(marqueeRect){
      const pos=d3.pointer(event,svg.node());
      const x=Math.min(startPos[0],pos[0]);
      const y=Math.min(startPos[1],pos[1]);
      const w=Math.abs(pos[0]-startPos[0]);
      const h=Math.abs(pos[1]-startPos[1]);
      marqueeRect.attr("x",x).attr("y",y).attr("width",w).attr("height",h);
    }
  })
  .on("mouseup",function(event){
    if(marqueeRect){
      const x=+marqueeRect.attr("x");
      const y=+marqueeRect.attr("y");
      const w=+marqueeRect.attr("width");
      const h=+marqueeRect.attr("height");
      marqueeRect.remove();
      marqueeRect=null;
      startPos=null;

      const shapes=svg.selectAll("g[data-type]");
      multiSelectedShapes.forEach(s=>s.classed("highlighted",false));
      multiSelectedShapes=[];

      shapes.each(function(){
        const shape=d3.select(this);
        const bbox=this.getBBox();
        const matrix=this.getCTM();
        const corners=[
          [bbox.x,bbox.y],
          [bbox.x+bbox.width,bbox.y],
          [bbox.x+bbox.width,bbox.y+bbox.height],
          [bbox.x,bbox.y+bbox.height]
        ].map(([cx,cy])=>{
          const p=svg.node().createSVGPoint();
          p.x=cx; p.y=cy;
          return [p.matrixTransform(matrix).x,p.matrixTransform(matrix).y];
        });
        const centerX=d3.mean(corners,d=>d[0]);
        const centerY=d3.mean(corners,d=>d[1]);
        if(centerX>=x && centerX<=x+w && centerY>=y && centerY<=y+h){
          multiSelectedShapes.push(shape);
          shape.classed("highlighted",true);
        }
      });
      selectedShape=null;
      updatePropertiesPanel();
      updateToolbarButtons();
    }
  });