import React, { useState, useCallback, useRef } from 'react';
import { generateCharacterJson, generateImageFromPrompt } from './services/geminiService';
import { CharacterPrompt, SceneResult } from './types';
import { IconButton } from './components/IconButton';
import { BrainIcon, ImageIcon, DownloadIcon, UploadIcon, ClearIcon, CodeIcon, UserCircleIcon } from './components/Icons';

const App: React.FC = () => {
  const [results, setResults] = useState<SceneResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [baseCharacterProfile, setBaseCharacterProfile] = useState<Pick<CharacterPrompt, 'character_id' | 'appearance'> | null>(null);
  const [viewingJson, setViewingJson] = useState<CharacterPrompt | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    handleReset();
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedJson = JSON.parse(content);

        if (!Array.isArray(parsedJson)) {
          throw new Error("The root of the JSON file must be an array `[]`.");
        }

        if (parsedJson.length === 0) {
            throw new Error("The JSON array cannot be empty.");
        }

        const sceneResults: SceneResult[] = parsedJson.map((item, index) => {
          let sceneDescription: string | null = null;

          if (typeof item === 'string' && item.trim()) {
            sceneDescription = item.trim();
          } else if (typeof item === 'object' && item !== null) {
            const potentialKeys = ['scene', 'prompt', 'description', 'text'];
            for (const key of potentialKeys) {
              if (typeof item[key] === 'string' && item[key].trim()) {
                sceneDescription = item[key].trim();
                break;
              }
            }
          }

          if (!sceneDescription) {
            throw new Error(`Item at index ${index} is invalid. It must be a non-empty string, or an object with a "scene", "prompt", "description", or "text" property.`);
          }
          
          return {
            id: index,
            scene: sceneDescription,
            jsonPrompt: null,
            image: null,
            status: 'pending',
            error: null,
          };
        });
        
        setResults(sceneResults);
        setFileError(null);

      } catch (error) {
        const errorMessage = `Error in ${file.name}: ${(error as Error).message}`;
        console.error(errorMessage);
        setResults([]);
        setFileError(errorMessage);
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateAll = useCallback(async () => {
    if (!results.length || isProcessing) return;

    setIsProcessing(true);
    setCompletedCount(0);
    let baseCharacter: Pick<CharacterPrompt, 'character_id' | 'appearance'> | undefined = undefined;
    
    for (let i = 0; i < results.length; i++) {
      const currentScene = results[i];
      setProgressMessage(`Processing scene ${i + 1} of ${results.length}: "${currentScene.scene}"`);
      
      try {
        setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'analyzing' } : r));
        const jsonPrompt = await generateCharacterJson(currentScene.scene, baseCharacter);
        
        if (i === 0) {
          baseCharacter = {
            character_id: jsonPrompt.character_id,
            appearance: jsonPrompt.appearance,
          };
          setBaseCharacterProfile(baseCharacter);
        }

        setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'generating', jsonPrompt } : r));
        const imageData = await generateImageFromPrompt(jsonPrompt);
        
        setResults(prev => prev.map(r => r.id === i ? { 
            ...r, 
            status: 'complete', 
            jsonPrompt,
            image: `data:image/png;base64,${imageData}`,
            error: null
        } : r));

      } catch (e) {
        const err = e as Error;
        console.error(`Error processing scene ${i + 1}:`, err);
        setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'error', error: err.message } : r));
      } finally {
        setCompletedCount(prev => prev + 1);
      }
    }

    setProgressMessage(`Batch processing complete. ${results.length} scenes processed.`);
    setIsProcessing(false);
  }, [results, isProcessing]);

  const handleDownloadImage = useCallback((result: SceneResult) => {
    if (!result.image || !result.jsonPrompt) return;
    const link = document.createElement('a');
    link.href = result.image;
    link.download = `scene_${result.jsonPrompt.character_id}_${result.id + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleReset = () => {
    setResults([]);
    setFileName('');
    setIsProcessing(false);
    setProgressMessage('');
    setBaseCharacterProfile(null);
    setViewingJson(null);
    setCompletedCount(0);
    setFileError(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const loadingSpinner = (text: string) => (
    <div className="flex flex-col items-center justify-center text-center gap-2 text-gray-400">
        <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400"></div>
            <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400 delay-200"></div>
            <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400 delay-400"></div>
        </div>
        <span className="text-sm font-semibold">{text.toUpperCase()}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Gemini Consistent Character Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Create consistent characters across multiple scenes from a single JSON file.
          </p>
        </header>

        <main className="flex flex-col gap-8">
          <div className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4">1. Upload &amp; Generate</h2>
            <div className="flex flex-wrap gap-4 items-center">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" id="file-upload" disabled={isProcessing} />
                <label htmlFor="file-upload" className={`flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition-colors duration-200 ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <UploadIcon />
                    <span>Upload .json File</span>
                </label>
              <IconButton onClick={handleGenerateAll} disabled={isProcessing || results.length === 0} icon={<BrainIcon />} label="Generate All Images" />
              <IconButton onClick={handleReset} disabled={isProcessing} icon={<ClearIcon />} label="Reset" className="!bg-red-600 hover:!bg-red-700 disabled:!bg-red-400 focus:!ring-red-500" />
            </div>
            <div className="mt-4 text-gray-400 text-sm">
                {fileName && !fileError && <p>File: <span className="font-semibold text-indigo-400">{fileName}</span> ({results.length} scenes found)</p>}
                {fileError && <p className="font-semibold text-red-400">{fileError}</p>}
                {isProcessing && <p className="mt-2">Status: <span className="font-semibold text-yellow-400">{progressMessage}</span></p>}
            </div>
          </div>
          
          {baseCharacterProfile && (
            <div className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 animate-fade-in">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-indigo-400">
                <UserCircleIcon />
                2. Consistent Character Profile
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Character ID</p>
                  <p className="font-mono text-green-400 bg-gray-900 px-2 py-1 rounded w-fit">{baseCharacterProfile.character_id}</p>
                </div>
                {Object.entries(baseCharacterProfile.appearance).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-gray-400 capitalize">{key.replace('_', ' ')}</p>
                    <p className="font-semibold text-base">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold mb-4">3. Results</h2>
            {results.length > 0 ? (
                <>
                {isProcessing && (
                    <div className="mb-6">
                        <div className="flex justify-between mb-1">
                            <span className="text-base font-medium text-indigo-400">Overall Progress</span>
                            <span className="text-sm font-medium text-indigo-400">{completedCount} / {results.length}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${results.length > 0 ? (completedCount / results.length) * 100 : 0}%`, transition: 'width 0.5s ease-in-out' }}></div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((result) => (
                    <div key={result.id} className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col">
                        <div className="aspect-square w-full bg-gray-900 rounded-t-xl flex items-center justify-center overflow-hidden">
                            {result.status === 'pending' && <div className="text-gray-500 text-center p-4"><ImageIcon /><p className="mt-2">Waiting to process</p></div>}
                            {result.status === 'analyzing' && loadingSpinner('Analyzing')}
                            {result.status === 'generating' && loadingSpinner('Generating')}
                            {result.status === 'error' && <div className="text-red-400 p-4 text-center">Error: {result.error}</div>}
                            {result.status === 'complete' && result.image && <img src={result.image} alt={`Scene: ${result.scene}`} className="w-full h-full object-cover" />}
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                            <p className="text-sm text-gray-400 flex-grow mb-4">&quot;{result.scene}&quot;</p>
                            <div className="flex gap-2 mt-auto">
                                <IconButton onClick={() => result.jsonPrompt && setViewingJson(result.jsonPrompt)} disabled={!result.jsonPrompt} icon={<CodeIcon />} label="JSON" className="flex-1 !bg-gray-600 hover:!bg-gray-700 disabled:!bg-gray-500" />
                                <IconButton onClick={() => handleDownloadImage(result)} disabled={result.status !== 'complete'} icon={<DownloadIcon />} label="Download" className="flex-1" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            </>
            ) : (
                <div className="text-center py-16 text-gray-500 bg-gray-800 rounded-xl border-2 border-dashed border-gray-700">
                    <p>Upload a .json file with your scene descriptions to begin.</p>
                    <p className="text-sm mt-2">Example formats: <code className="bg-gray-900 p-1 rounded text-gray-400">["scene one", "scene two"]</code> or <code className="bg-gray-900 p-1 rounded text-gray-400">{`[{"scene": "..."}]`}</code></p>
                </div>
            )}
          </div>
        </main>
      </div>

      {viewingJson && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setViewingJson(null)}>
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-indigo-400">Scene JSON Prompt</h3>
              <button onClick={() => setViewingJson(null)} className="text-gray-400 hover:text-white">
                <ClearIcon />
              </button>
            </div>
            <div className="overflow-auto">
              <pre className="bg-gray-900 text-green-300 p-4 rounded-md text-sm whitespace-pre-wrap break-all">
                <code>{JSON.stringify(viewingJson, null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
