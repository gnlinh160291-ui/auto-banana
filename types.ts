
export interface CharacterPrompt {
  character_id: string;
  appearance: {
    gender: string;
    hair: string;
    eyes: string;
    clothing: string;
    age: string;
  };
  scene: {
    context: string;
    action: string;
  };
  style: string;
}

export type SceneStatus = 'pending' | 'analyzing' | 'generating' | 'complete' | 'error';

export interface SceneResult {
  id: number;
  scene: string;
  jsonPrompt: CharacterPrompt | null;
  image: string | null;
  status: SceneStatus;
  error: string | null;
}
