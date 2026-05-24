const { useState } = React;

// 🛑 기존 lucide 객체 불러오기 삭제
// 대신 React에서 절대 에러가 나지 않는 100% 안전한 인라인 SVG 아이콘 컴포넌트를 만듭니다.
const Icon = ({ name, className = "", size = 24 }) => {
  const svgProps = {
    xmlns: "http://www.w3.org/2000/svg", width: size, height: size,
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round",
    className
  };
  
  switch (name) {
    case 'Sparkles': return <svg {...svgProps}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>;
    case 'Camera': return <svg {...svgProps}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
    case 'ChevronLeft': return <svg {...svgProps}><path d="m15 18-6-6 6-6"/></svg>;
    case 'User': return <svg {...svgProps}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'ShoppingBag': return <svg {...svgProps}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
    case 'ZoomIn': return <svg {...svgProps}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>;
    case 'RotateCw': return <svg {...svgProps}><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.9 1 6.7 2.7L21 8"/><path d="M21 3v5h-5"/></svg>;
    case 'Download': return <svg {...svgProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
    default: return <svg {...svgProps}></svg>;
  }
};

function StyleFitApp() {
  const [currentStep, setCurrentStep] = useState('home');
  const [modelImage, setModelImage] = useState(null);
  const [clothImage, setClothImage] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1, rotate: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (type === 'model') {
          setModelImage(event.target.result);
          setCurrentStep('upload-cloth');
        } else {
          setClothImage(event.target.result);
          setIsProcessing(true);
          setTimeout(() => {
            setIsProcessing(false);
            setCurrentStep('editor');
          }, 2000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - transform.x, y: clientY - transform.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setTransform({ ...transform, x: clientX - dragStart.x, y: clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetApp = () => {
    setModelImage(null);
    setClothImage(null);
    setTransform({ x: 0, y: 0, scale: 1, rotate: 0 });
    setCurrentStep('home');
  };

  // --- 화면 렌더링 ---
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-8 animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 rounded-full"></div>
        <div className="relative bg-white p-6 rounded-3xl shadow-xl">
          <Icon name="Sparkles" className="w-16 h-16 text-purple-600" />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">StyleFit</h1>
        <p className="text-gray-500">내 사진에 쇼핑몰 옷을 입혀보세요.<br/>AI가 당신의 핏을 찾아드립니다.</p>
      </div>
      <button onClick={() => setCurrentStep('upload-model')} className="w-full max-w-xs bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
        <Icon name="Camera" className="w-5 h-5" /> 시작하기
      </button>
    </div>
  );

  const renderUploadModel = () => (
    <div className="flex flex-col h-full px-6 pt-10 animate-fade-in">
      <button onClick={() => setCurrentStep('home')} className="mb-6 text-gray-500 hover:text-gray-900 w-fit">
        <Icon name="ChevronLeft" />
      </button>
      <h2 className="text-2xl font-bold mb-2 text-left">어떤 모습에<br/>입혀볼까요?</h2>
      <p className="text-gray-500 mb-8 text-left">전신이 잘 나온 사진이 가장 좋습니다.</p>
      <label className="flex-1 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative overflow-hidden group">
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'model')} className="hidden" />
        {modelImage ? (
          <img src={modelImage} alt="Model" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-40" />
        ) : (
          <div className="flex flex-col items-center space-y-4 z-10">
            <div className="bg-white p-4 rounded-full shadow-md">
              <Icon name="User" className="w-8 h-8 text-purple-600" />
            </div>
            <span className="font-medium text-gray-600">내 사진 업로드</span>
          </div>
        )}
      </label>
      <div className="mt-6 mb-8 text-center text-xs text-gray-400">
        사진은 서버에 저장되지 않고 기기 내에서만 처리됩니다.
      </div>
    </div>
  );

  const renderUploadCloth = () => (
    <div className="flex flex-col h-full px-6 pt-10 animate-fade-in">
      <button onClick={() => setCurrentStep('upload-model')} className="mb-6 text-gray-500 hover:text-gray-900 w-fit">
        <Icon name="ChevronLeft" />
      </button>
      <h2 className="text-2xl font-bold mb-2 text-left">입어볼 옷을<br/>선택해주세요</h2>
      <p className="text-gray-500 mb-8 text-left">쇼핑몰 캡처나 옷 사진을 올려주세요.</p>
      <label className="flex-1 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative overflow-hidden">
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cloth')} className="hidden" />
        <div className="flex flex-col items-center space-y-4 z-10">
          <div className="bg-white p-4 rounded-full shadow-md">
            <Icon name="ShoppingBag" className="w-8 h-8 text-pink-500" />
          </div>
          <span className="font-medium text-gray-600">옷 사진 / 쇼핑몰 이미지</span>
        </div>
      </label>
      <div className="mt-6 mb-8 text-center text-xs text-gray-400">
        배경이 복잡한 경우 AI가 자동으로 옷을 인식합니다.
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full bg-white z-50 fixed inset-0">
      <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-6"></div>
      <h3 className="text-xl font-bold text-gray-900">AI 분석 중...</h3>
      <p className="text-gray-500 mt-2">옷의 누끼를 따고 체형을 분석하고 있습니다.</p>
    </div>
  );

  const renderEditor = () => (
    <div className="flex flex-col h-full bg-gray-900 relative overflow-hidden select-none">
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={() => setCurrentStep('upload-cloth')} className="text-white p-2">
          <Icon name="ChevronLeft" />
        </button>
        <span className="text-white font-medium">StyleFit Studio</span>
        <button onClick={() => setCurrentStep('result')} className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
          완료
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-800" onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        {modelImage && (
          <img src={modelImage} alt="Model" className="absolute w-full h-full object-contain pointer-events-none opacity-90" />
        )}
        {clothImage && (
          <div className="absolute cursor-move" style={{transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotate}deg)`, touchAction: 'none' }} onTouchStart={handleMouseDown} onMouseDown={handleMouseDown}>
            <img src={clothImage} alt="Cloth" className="max-w-[250px] drop-shadow-2xl filter contrast-110" style={{ mixBlendMode: 'normal' }} />
            <div className="absolute inset-0 border-2 border-white/50 rounded-lg pointer-events-none"></div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 rounded-full whitespace-nowrap pointer-events-none">
              드래그하여 이동
            </div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-t-3xl p-6 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1"><Icon name="ZoomIn" size={12}/> 크기</span>
              <span>{Math.round(transform.scale * 100)}%</span>
            </div>
            <input type="range" min="0.1" max="2.5" step="0.05" value={transform.scale} onChange={(e) => setTransform({...transform, scale: parseFloat(e.target.value)})} className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1"><Icon name="RotateCw" size={12}/> 회전</span>
              <span>{transform.rotate}°</span>
            </div>
            <input type="range" min="-180" max="180" step="5" value={transform.rotate} onChange={(e) => setTransform({...transform, rotate: parseInt(e.target.value)})} className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
          </div>
        </div>
        <p className="text-center text-xs text-gray-400">
          두 손가락 제스처 대신 슬라이더를 사용하세요 (웹 프로토타입)
        </p>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      <div className="flex-1 relative bg-gray-100 flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full max-w-md bg-white shadow-2xl overflow-hidden">
          {modelImage && (
            <img src={modelImage} alt="Model" className="absolute w-full h-full object-cover" />
          )}
          {clothImage && (
            <img src={clothImage} alt="Cloth" className="absolute" style={{left: '50%', top: '50%', marginLeft: '-125px', marginTop: '-125px', transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotate}deg)`, maxWidth: '250px' }} />
          )}
          <div className="absolute bottom-4 right-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full">
            <span className="text-white text-xs font-bold tracking-widest">StyleFit</span>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4 bg-white">
        <h2 className="text-2xl font-bold text-gray-900 text-center">오늘의 스타일 완성!</h2>
        <div className="flex gap-3">
          <button onClick={resetApp} className="flex-1 py-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            처음으로
          </button>
          <button className="flex-1 bg-purple-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
            <Icon name="Download" size={20} /> 저장하기
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-4">
          이미지를 길게 누르면 저장할 수 있습니다.
        </p>
      </div>
    </div>
  );

  if (isProcessing) return renderLoading();

  return (
    <div className="w-full h-screen bg-gray-50 flex items-center justify-center font-sans">
      <div className="w-full h-full md:max-w-[420px] md:h-[850px] bg-white md:rounded-[40px] md:shadow-2xl overflow-hidden relative border-gray-200 md:border-8">
        <div className="hidden md:block absolute top-0 left-0 right-0 h-7 bg-gray-900 z-50 rounded-t-[30px]"></div>
        <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-6 bg-black rounded-b-2xl z-50"></div>
        <div className="w-full h-full pt-0 md:pt-4 pb-0 md:pb-0">
          {currentStep === 'home' && renderHome()}
          {currentStep === 'upload-model' && renderUploadModel()}
          {currentStep === 'upload-cloth' && renderUploadCloth()}
          {currentStep === 'editor' && renderEditor()}
          {currentStep === 'result' && renderResult()}
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<StyleFitApp />);
