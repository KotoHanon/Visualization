const DEEPSEEK_API_KEY = "";
const DEEPSEEK_API_ENDPOINT = "";

async function callDeepseekAPI(userText) {
    try {
    const result = await axios.post(
        DEEPSEEK_API_ENDPOINT,
        {
        model: 'deepseek-chat',
        messages: [
            { 
            role: 'system', 
            content: '你是一位智能前端编辑器，请严格按照以下 JSON 格式回答用户命令：{"response":"操作描述","action":"操作类型","factor":数值,"angle":数值,"dx":数值,"dy":数值,"newColor":"颜色代码"}。确保严格遵循JSON格式，不要包含任何多余的文字。选中图形的详细尺寸信息和颜色信息已包含在用户的指令中。'
            },
            { role: 'user', content: userText },
        ],
        max_tokens: 4096,
        temperature: 0.1,
        stream: false,
        },
        {
        headers: {
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        }
    );
    return result.data;
    } catch (error) {
    throw new Error('调用 Deepseek API 出错: ' + error.message);
    }
}

/*******************************************************
     * 1. D3.js 逻辑：多选 + 高光 + 折线箭头与图形锚点绑定
     *******************************************************/
const svg = d3.select("#svg-canvas");
const colorPicker = document.getElementById("color-picker");
const deleteButton = document.getElementById("delete-button");
const clearButton = document.getElementById("clear-button");
const colorButton = document.getElementById("color-button");
const propertiesPanel = document.getElementById("properties-panel");
const unbindButton = document.getElementById("unbind-button");
const saveButton = document.getElementById("save-button");
const loadButton = document.getElementById("load-button");
const startButton = document.getElementById("start-button");
const multiSelectButton = document.getElementById("multi-select-button");
const canvasBgPicker = document.getElementById("canvas-bg-picker");
const bringFrontButton = document.getElementById("bring-front-button");
const sendBackButton = document.getElementById("send-back-button");
const groupButton = document.getElementById("group-button");
const ungroupButton = document.getElementById("ungroup-button");
const alignLeftButton = document.getElementById("align-left-button");
const alignRightButton = document.getElementById("align-right-button");
const alignTopButton = document.getElementById("align-top-button");
const alignBottomButton = document.getElementById("align-bottom-button");
const downloadButton = document.getElementById("download-button");
const downloadDropdown = document.querySelector(".download-dropdown");
const downloadSVGButton = document.getElementById("download-svg-button");
const downloadPNGButton = document.getElementById("download-png-button");
const downloadJPGButton = document.getElementById("download-jpg-button");

let multiSelectedShapes = [];
let multiSelectMode = false;
const selectionBox = svg.append("rect")
  .attr("class", "selection-box")
  .attr("display", "none");

// 这两个数组只用于当前选中的图形
const anchors = [];
for (let i = 0; i < 8; i++) {
  anchors.push(svg.append("circle")
    .attr("class", "anchor")
    .attr("r", 6)
    .attr("display", "none"));
}
const controlPoints = [
  svg.append("circle")
      .attr("class", "control-point")
      .attr("r", 6)
      .attr("display", "none"),
  svg.append("circle")
      .attr("class", "control-point")
      .attr("r", 6)
      .attr("display", "none")
];
const rotateHandle = svg.append("circle")
  .attr("class", "rotate-handle")
  .attr("r", 8)
  .attr("display", "none");

let selectedShape = null;
let initialAngle = 0;
let initialMouseAngle = 0;

colorPicker.style.display = "none";

// 记录 line/polyline-arrow 与其它图形的绑定关系
const bindings = [];

// 图层调整
bringFrontButton.addEventListener("click", function(){
  if(selectedShape) selectedShape.raise();
  if(multiSelectedShapes.length>0) multiSelectedShapes.forEach(s => s.raise());
});
sendBackButton.addEventListener("click", function(){
  if(selectedShape) selectedShape.lower();
  if(multiSelectedShapes.length>0) multiSelectedShapes.forEach(s => s.lower());
});

// 通用拖拽
const dragBehavior = d3.drag()
  .on("start", function(event) {
    d3.select(this).classed("dragging", true);
  })
  .on("drag", function(event) {
    const group = d3.select(this);
    const transform = group.attr("data-transform") || "translate(0,0) rotate(0) scale(1)";

    const tData = parseTransform(transform);

    const updatedTransform = `translate(${event.x},${event.y}) rotate(${tData.rotate}) scale(${tData.scale})`;
    group.attr("transform", updatedTransform)
         .attr("data-transform", updatedTransform);

    updateSelection(group);
    updateBindings(); 
  })
  .on("end", function() {
    d3.select(this).classed("dragging", false);
  });

// 全局变量：当前选中的图形类型
let currentSelectedShapeType = null;

// 图形库点击事件：选择或取消选择形状类型
d3.selectAll(".shape-item").on("click", function(){
  const isSelected = d3.select(this).classed("highlighted");
  d3.selectAll(".shape-item").classed("highlighted", false);
  if(!isSelected){
    d3.select(this).classed("highlighted", true);
    currentSelectedShapeType = this.getAttribute('data-type');
  } else {
    currentSelectedShapeType = null;
  }
});

// 使用HTML5 Drag and Drop API实现从图形库拖拽到画布
const shapeLibraryItems = document.querySelectorAll('.shape-item');

shapeLibraryItems.forEach(item => {
  item.addEventListener('dragstart', function(event){
    const shapeType = this.getAttribute('data-type');
    event.dataTransfer.setData('shape-type', shapeType);
    // 为了兼容某些浏览器，需要设置拖拽图标
    const dragIcon = this.querySelector('svg').cloneNode(true);
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    event.dataTransfer.setDragImage(dragIcon, 40, 40);
    setTimeout(() => {
      document.body.removeChild(dragIcon);
    }, 0);
  });
});

// 允许SVG接收拖拽
const svgElement = document.getElementById('svg-canvas');
svgElement.addEventListener('dragover', function(event){
  event.preventDefault();
});
svgElement.addEventListener('drop', function(event){
  event.preventDefault();
  const shapeType = event.dataTransfer.getData('shape-type');
  if(shapeType){
    const [x, y] = d3.pointer(event, svg.node());
    createShape(shapeType, x, y);
  }
});

// 点击画布创建图形
// 合并了 createShape 和 hideSelection 的逻辑
svg.on("click", function(event) {
  // 确保不是在点击控件（如锚点、控制点、旋转手柄）等
  const target = event.target;
  if (target.closest('.anchor') || target.closest('.control-point') || target.closest('.rotate-handle') || target.closest('.toolbar') || target.closest('.properties-panel') || target.closest('.download-dropdown')) {
    return;
  }

  if(currentSelectedShapeType){
    const [x, y] = d3.pointer(event, svg.node());
    createShape(currentSelectedShapeType, x, y);
    // After creating a shape, you might want to deselect the current shape type
    // Uncomment the following lines if desired
    /*
    currentSelectedShapeType = null;
    d3.selectAll(".shape-item").classed("highlighted", false);
    */
  }

  // Hide selection if not creating a shape
  hideSelection();
});

// 图形点击事件
function onShapeClick(event) {
  event.stopPropagation();
  
  // Deselect any shape type selection
  d3.selectAll(".shape-item").classed("highlighted", false);
  currentSelectedShapeType = null;

  const shape = d3.select(this);

  if(event.shiftKey){
    const idx=multiSelectedShapes.indexOf(shape);
    if(idx>=0){
      multiSelectedShapes.splice(idx,1);
      shape.classed("highlighted",false);
    } else {
      multiSelectedShapes.push(shape);
      shape.classed("highlighted",true);
    }
    updateToolbarButtons();
    return;
  }

  if(multiSelectMode){
    if(!multiSelectedShapes.includes(shape)){
      multiSelectedShapes.push(shape);
      shape.classed("highlighted",true);
    }
    updateToolbarButtons();
  } else {
    if(selectedShape && selectedShape.node()!==shape.node()){
      selectedShape.classed("highlighted",false);
    }
    multiSelectedShapes.forEach(s => s.classed("highlighted", false));
    multiSelectedShapes=[];
    selectedShape=shape;
    selectedShape.classed("highlighted",true);
    updateSelection(selectedShape);
    showPropertiesPanel(selectedShape);
    updateToolbarButtons();
  }
}

// 创建图形函数：根据类型在指定位置创建图形
function createShape(shapeType, x, y){
  const group=svg.append("g")
    .attr("transform",`translate(${x},${y}) rotate(0) scale(1)`)
    .attr("data-transform",`translate(${x},${y}) rotate(0) scale(1)`)
    .attr("data-type",shapeType);

  let newShape;
  if(shapeType==="circle"){
    newShape=group.append("circle").attr("cx",0).attr("cy",0).attr("r",25).attr("fill","#007BFF");
  } else if(shapeType==="rect"){
    newShape=group.append("rect").attr("x",-20).attr("y",-20).attr("width",40).attr("height",40).attr("fill","#28A745");
  } else if(shapeType==="triangle"){
    newShape=group.append("polygon").attr("points","0,-25 25,25 -25,25").attr("fill","#FF8C00");
  } else if(shapeType==="arrow"){
    newShape=group.append("polygon").attr("points","0,20 20,0 40,20 30,20 30,40 10,40 10,20").attr("fill","#FFC107");
  } else if(shapeType==="line"){
    newShape=group.append("line").attr("x1",-50).attr("y1",0).attr("x2",50).attr("y2",0).attr("stroke","#6F42C1").attr("stroke-width",4);
  } else if(shapeType==="round-rect"){
    newShape=group.append("rect").attr("x",-20).attr("y",-15).attr("width",40).attr("height",30).attr("rx",8).attr("ry",8).attr("fill","#17A2B8");
  } else if(shapeType==="ellipse"){
    newShape=group.append("ellipse").attr("cx",0).attr("cy",0).attr("rx",25).attr("ry",15).attr("fill","#E83E8C");
  } else if(shapeType==="heart"){
    newShape=group.append("path").attr("d","M0,15 A10,10 0 1,1 20,15 A10,10 0 1,1 40,15 Q40,30 20,45 Q0,30 0,15 Z").attr("fill","#FF69B4");
  } else if(shapeType==="text"){
    newShape=group.append("text").attr("x",0).attr("y",0).attr("text-anchor","middle").attr("dominant-baseline","middle").attr("class","editable-text").attr("fill","#000").text("双击编辑");
  } else if(shapeType==="star"){
    newShape=group.append("polygon").attr("points",calculateStarPoints(0,0,25,12.5,5)).attr("fill","#FFD700");
  } else if(shapeType==="polyline-arrow"){
    const pointsArray=[[0,0],[40,-30],[70,-30],[100,0]];
    const polyline=group.append("polyline")
      .attr("fill","none")
      .attr("stroke","#000")
      .attr("stroke-width",2)
      .attr("data-points",JSON.stringify(pointsArray))
      .attr("points",pointsArray.map(d=>d.join(",")).join(" "));
    const arrow=group.append("polygon")
      .attr("points","-5,-5 0,0 -5,5")
      .attr("fill","#000")
      .attr("data-endpoint","100,0");
    newShape=polyline;
  }
  // 新增工艺流程图图形
  else if(shapeType==="diamond"){
    newShape=group.append("polygon").attr("points","0,-25 25,0 0,25 -25,0").attr("fill","#FF6347");
  } else if(shapeType==="parallelogram"){
    newShape=group.append("polygon").attr("points","10,-15 40,-15 30,15 0,15").attr("fill","#20B2AA");
  } else if(shapeType==="trapezoid"){
    newShape=group.append("polygon").attr("points","10,-15 40,-15 35,15 5,15").attr("fill","#DAA520");
  } else if(shapeType==="subprocess"){
    // 子过程：双矩形
    group.append("rect").attr("x",-25).attr("y",-25).attr("width",50).attr("height",50).attr("fill","#8A2BE2");
    newShape=group.append("rect").attr("x",-20).attr("y",-20).attr("width",40).attr("height",40).attr("fill","#9370DB");
  } else if(shapeType==="document"){
    newShape=group.append("path")
      .attr("d","M-20,-20 L20,-20 L20,20 L-20,20 Z")
      .attr("fill","#4682B4")
      .attr("stroke","#4682B4")
      .attr("stroke-width",2);
    group.append("path")
      .attr("d","M20,-20 Q25,-10 20,0 L20,20")
      .attr("fill","none")
      .attr("stroke","#4682B4")
      .attr("stroke-width",2);
    newShape=group.selectAll("path");
  }
  // ------------------------------

  group.call(dragBehavior);
  group.on("click", onShapeClick);
  group.on("dblclick", function(event){
    event.stopPropagation();
    const shape=d3.select(this);
    const firstElement=shape.select('*').node();
    if(firstElement && firstElement.tagName==="text"){
      editTextElement(shape);
    }
  });

  group.attr("opacity",0)
       .transition()
       .duration(500)
       .attr("opacity",1);
}

// 改颜色
colorButton.addEventListener("click", function(){
  if(selectedShape || multiSelectedShapes.length>0){
    showColorPicker();
  }
});
function showColorPicker(){
  let shape=selectedShape;
  if(multiSelectedShapes.length>0){
    shape=multiSelectedShapes[0];
  }
  if(shape){
    const bbox=shape.node().getBBox();
    const matrix=shape.node().getCTM();

    const center = [
      bbox.x + bbox.width / 2,
      bbox.y + bbox.height / 2
    ];
    const screenPoint = svg.node().createSVGPoint();
    screenPoint.x = center[0];
    screenPoint.y = center[1];
    const transformedPoint = screenPoint.matrixTransform(matrix);

    colorPicker.style.left=`${transformedPoint.x + window.scrollX - 25}px`;
    colorPicker.style.top=`${transformedPoint.y + window.scrollY - 25}px`;
    colorPicker.style.display="block";

    const firstElement=shape.select('*').node();
    if(firstElement.tagName==="line"){
      colorPicker.value=d3.select(firstElement).attr("stroke");
    } else if(firstElement.tagName==="text"){
      colorPicker.value=d3.select(firstElement).attr("fill");
    } else if(firstElement.tagName==="polyline"){
      colorPicker.value=d3.select(firstElement).attr("stroke");
    } else {
      colorPicker.value=d3.select(firstElement).attr("fill");
    }
  }
}
colorPicker.addEventListener("input", function(){
  if(selectedShape || multiSelectedShapes.length>0){
    const newColor=this.value;
    if(selectedShape) changeShapeColor(selectedShape,newColor);
    if(multiSelectedShapes.length>0){
      multiSelectedShapes.forEach(s=>changeShapeColor(s,newColor));
    }
    updatePropertiesPanel();
  }
});

// 画布背景
canvasBgPicker.addEventListener("input",function(){
  const newBgColor=this.value;
  svg.style("background-color",newBgColor);
});

// 删除
deleteButton.addEventListener("click",function(){
  if(selectedShape){
    selectedShape.remove();
    removeBindingsForShape(selectedShape);
    hideSelection();
  }
  if(multiSelectedShapes.length>0){
    multiSelectedShapes.forEach(s=>{
      s.remove();
      removeBindingsForShape(s);
    });
    hideSelection();
  }
});

// 清空
clearButton.addEventListener("click",function(){
  svg.selectAll("g").remove();
  hideSelection();
});

// 解绑
unbindButton.addEventListener("click",function(){
  if(selectedShape){
    removeBindingsForShape(selectedShape);
    updateSelection(selectedShape);
    updateBindings();
  }
  if(multiSelectedShapes.length>0){
    multiSelectedShapes.forEach(shape=>{
      removeBindingsForShape(shape);
      updateSelection(shape);
      updateBindings();
    });
  }
});

// 开始按钮
startButton.addEventListener("click",function(){
  if(multiSelectedShapes.length===2){
    const shapeA=multiSelectedShapes[0];
    const shapeB=multiSelectedShapes[1];
    const lineWithBindings=findLineConnectingShapes(shapeA, shapeB);
    if(lineWithBindings){
      runFlowFromTwoShapes(lineWithBindings.line, shapeA, shapeB);
    } else {
      alert("未找到连接所选图形的折线箭头。");
    }
  } else {
    alert("请选择两个图形以启动流动动画。");
  }
});

// 组合按钮
groupButton.addEventListener("click", function(){
  groupSelectedShapes();
});

// 拆散按钮
ungroupButton.addEventListener("click", function(){
  if(selectedShape && selectedShape.attr("data-type") === "group"){
    ungroupSelectedShape(selectedShape);
  }
});