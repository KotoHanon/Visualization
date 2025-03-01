function updateSelection(shape){
    svg.selectAll(".polyline-control-point").remove();
    const shapeType=shape.attr("data-type");
    const transform=shape.attr("data-transform")||"";
    const tData=parseTransform(transform);
    const matrix=shape.node().getCTM();

    if(shapeType==="polyline-arrow"){
      // 显示 selectionBox + rotateHandle + 8 anchors, 并额外显示 4 个 polyline-control-point
      selectionBox.attr("display","block");
      controlPoints.forEach(cp=>cp.attr("display","none"));

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
        [(corners[3][0]+corners[0][0])/2,(corners[3][1]+corners[0][1])/2],
      ];

      const xCoords=corners.map(d=>d[0]);
      const yCoords=corners.map(d=>d[1]);
      const minX=Math.min(...xCoords);
      const minY=Math.min(...yCoords);
      const maxX=Math.max(...xCoords);
      const maxY=Math.max(...yCoords);
      const centerX=(minX+maxX)/2;
      const centerY=(minY+maxY)/2;

      selectionBox
        .attr("x",minX)
        .attr("y",minY)
        .attr("width",maxX-minX)
        .attr("height",maxY-minY)
        .attr("transform",`rotate(${tData.rotate},${centerX},${centerY})`);

      const handleOffset=20;
      const rotatedMinY=corners.reduce((acc,pt)=>pt[1]<acc?pt[1]:acc,Infinity);

      rotateHandle
        .attr("cx",centerX)
        .attr("cy",rotatedMinY-handleOffset)
        .attr("display","block")
        .call(d3.drag()
          .on("start",(event)=>{
            initialMouseAngle=Math.atan2(event.y-centerY,event.x-centerX)*180/Math.PI;
            initialAngle=tData.rotate;
          })
          .on("drag",(event)=>{
            const currentMouseAngle=Math.atan2(event.y-centerY,event.x-centerX)*180/Math.PI;
            const angleDiff=currentMouseAngle-initialMouseAngle;
            const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${initialAngle+angleDiff}) scale(${tData.scale})`;
            shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
            updateSelection(shape);
            updateBindings();
            showPropertiesPanel(shape);
          })
        );

      // 8 anchors: 4 corners + 4 midpoints
      anchors.forEach((anchor,i)=>{
        if(i<4){
          anchor
            .attr("cx",corners[i][0])
            .attr("cy",corners[i][1])
            .attr("display","block")
            .call(d3.drag()
              .on("start",function(event){
                this.initialScale=tData.scale;
                this.startDistance=Math.hypot(event.x-centerX,event.y-centerY);
              })
              .on("drag",function(event){
                const currentDistance=Math.hypot(event.x-centerX,event.y-centerY);
                const scaleFactor=currentDistance/this.startDistance;
                const newScale=this.initialScale*scaleFactor;
                const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${tData.rotate}) scale(${newScale})`;
                shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
                updateSelection(shape);
                updateBindings();
                showPropertiesPanel(shape);
              })
            );
        } else {
          anchor
            .attr("cx",midpoints[i-4][0])
            .attr("cy",midpoints[i-4][1])
            .attr("display","block")
            .call(d3.drag()
              .on("start",function(event){
                this.initialScale=tData.scale;
                this.startDistance=Math.hypot(event.x-centerX,event.y-centerY);
              })
              .on("drag",function(event){
                const currentDistance=Math.hypot(event.x-centerX,event.y-centerY);
                const scaleFactor=currentDistance/this.startDistance;
                const newScale=this.initialScale*scaleFactor;
                const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${tData.rotate}) scale(${newScale})`;
                shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
                updateSelection(shape);
                updateBindings();
                showPropertiesPanel(shape);
              })
            );
        }
      });

      // 4个可拖拽控制点
      const polyline=shape.select("polyline");
      if(!polyline.empty()){
        const pointsData=JSON.parse(polyline.attr("data-points"));
        pointsData.forEach((pt,idx)=>{
          const scrPt=svg.node().createSVGPoint();
          scrPt.x=pt[0];
          scrPt.y=pt[1];
          const sp=scrPt.matrixTransform(shape.node().getCTM());
          const circle=svg.append("circle")
            .attr("class","polyline-control-point")
            .attr("r",6)
            .attr("cx",sp.x)
            .attr("cy",sp.y)
            .call(d3.drag()
              .on("start",function(event){
                this.inverseMatrix=shape.node().getCTM().inverse();
              })
              .on("drag",function(event){
                const newX=event.x;
                const newY=event.y;
                const transformedPoint=svg.node().createSVGPoint();
                transformedPoint.x=newX; transformedPoint.y=newY;
                const lp=transformedPoint.matrixTransform(this.inverseMatrix);
                pointsData[idx]=[lp.x,lp.y];
                polyline
                  .attr("data-points",JSON.stringify(pointsData))
                  .attr("points",pointsData.map(d=>d.join(",")).join(" "));
                const arrow=shape.select("polygon[data-endpoint]");
                if(!arrow.empty()){
                  const lastPt=pointsData[pointsData.length-1];
                  arrow.attr("data-endpoint",`${lastPt[0]},${lastPt[1]}`);
                  const arrowCoords=computeArrowCoords(lastPt,pointsData[pointsData.length-2]);
                  arrow.attr("points",arrowCoords.points)
                       .attr("transform",`translate(${lastPt[0]},${lastPt[1]}) rotate(${arrowCoords.angle})`);
                }
                d3.select(this).attr("cx",newX).attr("cy",newY);

                // 更新 selection + 检测绑定
                updateSelection(shape);
                detectAndHandleBinding(d3.select(this),shape,idx);
                updateBindings();
                showPropertiesPanel(shape);
              })
            );
        });
      }

    } else if(shapeType==="line"){
      // 显示 2 controlPoints, hidden anchors
      selectionBox.attr("display","none");
      rotateHandle.attr("display","none");
      anchors.forEach(a=>a.attr("display","none"));
      controlPoints.forEach(cp=>cp.attr("display","block"));
      const line=shape.select("line");
      let x1=+line.attr("x1");
      let y1=+line.attr("y1");
      let x2=+line.attr("x2");
      let y2=+line.attr("y2");
      let point1=svg.node().createSVGPoint();
      point1.x=x1; point1.y=y1;
      point1=point1.matrixTransform(shape.node().getCTM());
      let point2=svg.node().createSVGPoint();
      point2.x=x2; point2.y=y2;
      point2=point2.matrixTransform(shape.node().getCTM());
      controlPoints[0]
        .attr("cx",point1.x)
        .attr("cy",point1.y)
        .call(d3.drag()
          .on("start",function(event){
            this.inverseMatrix=shape.node().getCTM().inverse();
          })
          .on("drag",function(event){
            const newPt={x:event.x,y:event.y};
            const transformedPoint=svg.node().createSVGPoint();
            transformedPoint.x=newPt.x; transformedPoint.y=newPt.y;
            const lp=transformedPoint.matrixTransform(this.inverseMatrix);
            line.attr("x1",lp.x).attr("y1",lp.y);
            updateSelection(shape);
            detectAndHandleBinding(d3.select(this),shape,0);
            updateBindings();
            showPropertiesPanel(shape);
          })
        );
      controlPoints[1]
        .attr("cx",point2.x)
        .attr("cy",point2.y)
        .call(d3.drag()
          .on("start",function(event){
            this.inverseMatrix=shape.node().getCTM().inverse();
          })
          .on("drag",function(event){
            const newPt={x:event.x,y:event.y};
            const transformedPoint=svg.node().createSVGPoint();
            transformedPoint.x=newPt.x; transformedPoint.y=newPt.y;
            const lp=transformedPoint.matrixTransform(this.inverseMatrix);
            line.attr("x2",lp.x).attr("y2",lp.y);
            updateSelection(shape);
            detectAndHandleBinding(d3.select(this),shape,1);
            updateBindings();
            showPropertiesPanel(shape);
          })
        );
    } else {
      // 其余图形
      controlPoints.forEach(cp=>cp.attr("display","none"));
      selectionBox.attr("display","block");

      let bbox;
      if(shapeType==="text"){
        const txt=shape.select("text");
        bbox=txt.node().getBBox();
      } else {
        bbox=shape.node().getBBox();
      }
      const matrix=shape.node().getCTM();
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
        [(corners[3][0]+corners[0][0])/2,(corners[3][1]+corners[0][1])/2],
      ];
      const xCoords=corners.map(d=>d[0]);
      const yCoords=corners.map(d=>d[1]);
      const minX=Math.min(...xCoords);
      const minY=Math.min(...yCoords);
      const maxX=Math.max(...xCoords);
      const maxY=Math.max(...yCoords);
      const centerX=(minX+maxX)/2;
      const centerY=(minY+maxY)/2;

      selectionBox
        .attr("x",minX)
        .attr("y",minY)
        .attr("width",maxX-minX)
        .attr("height",maxY-minY)
        .attr("transform",`rotate(${parseFloat(tData.rotate)},${centerX},${centerY})`);

      const handleOffset=20;
      const rotatedMinY=corners.reduce((acc,pt)=>pt[1]<acc?pt[1]:acc,Infinity);

      rotateHandle
        .attr("cx",centerX)
        .attr("cy",rotatedMinY-handleOffset)
        .attr("display","block")
        .call(d3.drag()
          .on("start",function(event){
            initialMouseAngle=Math.atan2(event.y-centerY,event.x-centerX)*180/Math.PI;
            initialAngle=tData.rotate;
          })
          .on("drag",function(event){
            const currentMouseAngle=Math.atan2(event.y-centerY,event.x-centerX)*180/Math.PI;
            const angleDiff=currentMouseAngle-initialMouseAngle;
            const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${tData.rotate+angleDiff}) scale(${tData.scale})`;
            shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
            updateSelection(shape);
            updateBindings();
            showPropertiesPanel(shape);
          })
        );

      anchors.forEach((anchor,i)=>{
        if(i<4){
          anchor
            .attr("cx",corners[i][0])
            .attr("cy",corners[i][1])
            .attr("display","block")
            .call(d3.drag()
              .on("start",function(event){
                this.initialScale=tData.scale;
                this.startDistance=Math.hypot(event.x-centerX,event.y-centerY);
              })
              .on("drag",function(event){
                const currentDistance=Math.hypot(event.x-centerX,event.y-centerY);
                const scaleFactor=currentDistance/this.startDistance;
                const newScale=this.initialScale*scaleFactor;
                const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${tData.rotate}) scale(${newScale})`;
                shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
                updateSelection(shape);
                updateBindings();
                showPropertiesPanel(shape);
              })
            );
        } else {
          anchor
            .attr("cx",midpoints[i-4][0])
            .attr("cy",midpoints[i-4][1])
            .attr("display","block")
            .call(d3.drag()
              .on("start",function(event){
                this.initialScale=tData.scale;
                this.startDistance=Math.hypot(event.x-centerX,event.y-centerY);
              })
              .on("drag",function(event){
                const currentDistance=Math.hypot(event.x-centerX,event.y-centerY);
                const scaleFactor=currentDistance/this.startDistance;
                const newScale=this.initialScale*scaleFactor;
                const updatedTransform=`translate(${tData.translate.x},${tData.translate.y}) rotate(${tData.rotate}) scale(${newScale})`;
                shape.attr("transform",updatedTransform).attr("data-transform",updatedTransform);
                updateSelection(shape);
                updateBindings();
                showPropertiesPanel(shape);
              })
            );
        }
      });
    }
  }

  function editTextElement(shape){
    const textElement=shape.select("text");
    const currentText=textElement.text();
    const bbox=textElement.node().getBBox();
    const input=document.createElement("input");
    input.type="text";
    input.value=currentText;
    input.style.position="absolute";
    input.style.left=`${bbox.x + window.scrollX}px`;
    input.style.top=`${bbox.y + window.scrollY}px`;
    input.style.width=`${bbox.width}px`;
    input.style.height=`${bbox.height}px`;
    input.style.fontSize=`${textElement.style("font-size")||24}px`;
    input.style.fontFamily=textElement.style("font-family")||'Roboto, sans-serif';
    input.style.textAlign="center";
    input.style.transformOrigin="center";
    input.style.transform=`rotate(${getRotationAngle(shape)}deg)`;
    input.style.border="1px solid #ccc";
    input.style.padding="0";
    input.style.margin="0";
    input.style.background="transparent";
    input.style.outline="none";
    document.body.appendChild(input);
    input.focus();
    input.addEventListener("blur",function(){
      const newText=input.value||"双击编辑";
      textElement.text(newText);
      document.body.removeChild(input);
      updatePropertiesPanel();
    });
    input.addEventListener("keydown",function(e){
      if(e.key==="Enter"){
        input.blur();
      }
    });
  }

  function parseTransform(transform){
    const translateMatch=/translate\(([^,]+),([^)]+)\)/.exec(transform)||[0,0,0];
    const rotateMatch=/rotate\(([^)]+)\)/.exec(transform)||[0,0];
    const scaleMatch=/scale\(([^)]+)\)/.exec(transform)||[0,1];
    return {
      translate:{x:parseFloat(translateMatch[1]),y:parseFloat(translateMatch[2])},
      rotate:parseFloat(rotateMatch[1]),
      scale:parseFloat(scaleMatch[1])
    };
  }

  function showPropertiesPanel(shape){
    if(!shape) return;
    propertiesPanel.innerHTML='';
    const heading=document.createElement('h3');
    heading.textContent='图形属性';
    propertiesPanel.appendChild(heading);

    const info=getSelectedShapeInfo(shape);
    if(!info) return;

    // 添加位置属性
    const posLabel=document.createElement('label');
    posLabel.textContent='位置 (X, Y)：';
    const posInputX=document.createElement('input');
    posInputX.type='number';
    posInputX.name='posX';
    posInputX.value=info.transform.translate.x.toFixed(2);
    const posInputY=document.createElement('input');
    posInputY.type='number';
    posInputY.name='posY';
    posInputY.value=info.transform.translate.y.toFixed(2);
    posLabel.appendChild(posInputX);
    posLabel.appendChild(document.createTextNode(', '));
    posLabel.appendChild(posInputY);
    form.appendChild(posLabel);

    // 添加旋转属性
    const rotateLabel=document.createElement('label');
    rotateLabel.textContent='旋转 (°)：';
    const rotateInput=document.createElement('input');
    rotateInput.type='number';
    rotateInput.name='rotate';
    rotateInput.value=info.transform.rotate.toFixed(2);
    rotateLabel.appendChild(rotateInput);
    form.appendChild(rotateLabel);

    // 添加缩放属性
    const scaleLabel=document.createElement('label');
    scaleLabel.textContent='缩放：';
    const scaleInput=document.createElement('input');
    scaleInput.type='number';
    scaleInput.name='scale';
    scaleInput.step='0.1';
    scaleInput.min='0.1';
    scaleInput.value=info.transform.scale.toFixed(2);
    scaleLabel.appendChild(scaleInput);
    form.appendChild(scaleLabel);

    // 添加尺寸属性
    if(shapeType==="circle"){
      const radiusLabel=document.createElement('label');
      radiusLabel.textContent='半径：';
      const radiusInput=document.createElement('input');
      radiusInput.type='number';
      radiusInput.name='radius';
      radiusInput.min='1';
      radiusInput.value=info.r.toFixed(2);
      radiusLabel.appendChild(radiusInput);
      form.appendChild(radiusLabel);
    } else if(shapeType==="rect" || shapeType==="round-rect"){
      const widthLabel=document.createElement('label');
      widthLabel.textContent='宽度：';
      const widthInput=document.createElement('input');
      widthInput.type='number';
      widthInput.name='width';
      widthInput.min='1';
      widthInput.value=info.width.toFixed(2);
      widthLabel.appendChild(widthInput);
      form.appendChild(widthLabel);

      const heightLabel=document.createElement('label');
      heightLabel.textContent='高度：';
      const heightInput=document.createElement('input');
      heightInput.type='number';
      heightInput.name='height';
      heightInput.min='1';
      heightInput.value=info.height.toFixed(2);
      heightLabel.appendChild(heightInput);
      form.appendChild(heightLabel);

      if(shapeType==="round-rect"){
        const rxLabel=document.createElement('label');
        rxLabel.textContent='圆角 X：';
        const rxInput=document.createElement('input');
        rxInput.type='number';
        rxInput.name='rx';
        rxInput.min='0';
        rxInput.value=info.rx.toFixed(2);
        rxLabel.appendChild(rxInput);
        form.appendChild(rxLabel);

        const ryLabel=document.createElement('label');
        ryLabel.textContent='圆角 Y：';
        const ryInput=document.createElement('input');
        ryInput.type='number';
        ryInput.name='ry';
        ryInput.min='0';
        ryInput.value=info.ry.toFixed(2);
        ryLabel.appendChild(ryInput);
        form.appendChild(ryLabel);
      }
    } else if(shapeType==="ellipse"){
      const rxLabel=document.createElement('label');
      rxLabel.textContent='半径 X：';
      const rxInput=document.createElement('input');
      rxInput.type='number';
      rxInput.name='rx';
      rxInput.min='1';
      rxInput.value=info.rx.toFixed(2);
      rxLabel.appendChild(rxInput);
      form.appendChild(rxLabel);

      const ryLabel=document.createElement('label');
      ryLabel.textContent='半径 Y：';
      const ryInput=document.createElement('input');
      ryInput.type='number';
      ryInput.name='ry';
      ryInput.min='1';
      ryInput.value=info.ry.toFixed(2);
      ryLabel.appendChild(ryInput);
      form.appendChild(ryLabel);
    } else if(shapeType==="line"){
      const x1Label=document.createElement('label');
      x1Label.textContent='起点 X1：';
      const x1Input=document.createElement('input');
      x1Input.type='number';
      x1Input.name='x1';
      x1Input.value=info.x1.toFixed(2);
      x1Label.appendChild(x1Input);
      form.appendChild(x1Label);

      const y1Label=document.createElement('label');
      y1Label.textContent='起点 Y1：';
      const y1Input=document.createElement('input');
      y1Input.type='number';
      y1Input.name='y1';
      y1Input.value=info.y1.toFixed(2);
      y1Label.appendChild(y1Input);
      form.appendChild(y1Label);

      const x2Label=document.createElement('label');
      x2Label.textContent='终点 X2：';
      const x2Input=document.createElement('input');
      x2Input.type='number';
      x2Input.name='x2';
      x2Input.value=info.x2.toFixed(2);
      x2Label.appendChild(x2Input);
      form.appendChild(x2Label);

      const y2Label=document.createElement('label');
      y2Label.textContent='终点 Y2：';
      const y2Input=document.createElement('input');
      y2Input.type='number';
      y2Input.name='y2';
      y2Input.value=info.y2.toFixed(2);
      y2Label.appendChild(y2Input);
      form.appendChild(y2Label);
    } else if(shapeType==="text"){
      const textLabel=document.createElement('label');
      textLabel.textContent='文本内容：';
      const textInput=document.createElement('input');
      textInput.type='text';
      textInput.name='text';
      textInput.value=info.text;
      textLabel.appendChild(textInput);
      form.appendChild(textLabel);

      const fontSizeLabel=document.createElement('label');
      fontSizeLabel.textContent='字体大小：';
      const fontSizeInput=document.createElement('input');
      fontSizeInput.type='number';
      fontSizeInput.name='fontSize';
      fontSizeInput.min='1';
      fontSizeInput.value=parseInt(info.fontSize) || 24;
      fontSizeLabel.appendChild(fontSizeInput);
      form.appendChild(fontSizeLabel);
    } else {
      // 其他图形类型可以在这里添加更多属性
    }

    // 添加颜色属性
    const colorLabel=document.createElement('label');
    colorLabel.textContent='颜色：';
    const colorInput=document.createElement('input');
    colorInput.type='color';
    colorInput.name='color';
    colorInput.value=info.color || '#000000';
    colorLabel.appendChild(colorInput);
    form.appendChild(colorLabel);

    const submitButton=document.createElement('button');
    submitButton.type='submit';
    submitButton.textContent='应用';
    form.appendChild(submitButton);
    propertiesPanel.appendChild(form);

    propertiesPanel.style.display='block';

    form.addEventListener('submit',function(e){
      e.preventDefault();
      const formData=new FormData(form);
      // 更新位置
      const posX=parseFloat(formData.get('posX'));
      const posY=parseFloat(formData.get('posY'));
      const rotate=parseFloat(formData.get('rotate'));
      const scale=parseFloat(formData.get('scale'));
      const updatedTransform=`translate(${posX},${posY}) rotate(${rotate}) scale(${scale})`;
      shape.attr("transform", updatedTransform).attr("data-transform", updatedTransform);

      // 更新尺寸
      if(shapeType==="circle"){
        const radius=parseFloat(formData.get('radius'));
        if(radius>0){
          shape.select("circle").attr("r",radius);
        }
      } else if(shapeType==="rect" || shapeType==="round-rect"){
        const width=parseFloat(formData.get('width'));
        const height=parseFloat(formData.get('height'));
        if(width>0 && height>0){
          shape.select("rect").attr("width",width).attr("height",height);
          shape.select("rect").attr("x",-width/2).attr("y",-height/2);
        }
        if(shapeType==="round-rect"){
          const rx=parseFloat(formData.get('rx'));
          const ry=parseFloat(formData.get('ry'));
          shape.select("rect").attr("rx",rx).attr("ry",ry);
        }
      } else if(shapeType==="ellipse"){
        const rx=parseFloat(formData.get('rx'));
        const ry=parseFloat(formData.get('ry'));
        if(rx>0 && ry>0){
          shape.select("ellipse").attr("rx",rx).attr("ry",ry);
        }
      } else if(shapeType==="line"){
        const x1=parseFloat(formData.get('x1'));
        const y1=parseFloat(formData.get('y1'));
        const x2=parseFloat(formData.get('x2'));
        const y2=parseFloat(formData.get('y2'));
        shape.select("line").attr("x1",x1).attr("y1",y1).attr("x2",x2).attr("y2",y2);
      } else if(shapeType==="text"){
        const text=formData.get('text');
        const fontSize=parseFloat(formData.get('fontSize'));
        shape.select("text").text(text).attr("font-size",fontSize);
      } else {
        // 其他图形类型可以在这里添加更多属性更新
      }

      // 更新颜色
      const newColor=formData.get('color');
      if(newColor){
        changeShapeColor(shape, newColor);
      }

      updateSelection(shape);
      updateBindings();
    });
  }

  function updatePropertiesPanel(){
    if(selectedShape){
      showPropertiesPanel(selectedShape);
    } else if(multiSelectedShapes.length>0){
      // 可以选择显示多个图形的共同属性，或提示用户
      propertiesPanel.innerHTML='';
      const heading=document.createElement('h3');
      heading.textContent='图形属性';
      propertiesPanel.appendChild(heading);
      const infoP=document.createElement('p');
      infoP.textContent=`已选中 ${multiSelectedShapes.length} 个图形。`;
      propertiesPanel.appendChild(infoP);
      propertiesPanel.style.display='block';
    } else {
      propertiesPanel.style.display='none';
    }
  }