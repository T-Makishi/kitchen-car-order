export type OptionChoice = { id: string; name: string; price: number; soldOut?: boolean };
export type OptionGroup = { id: string; name: string; required: boolean; min: number; max: number; choices: OptionChoice[] };
export type MenuItem = {
  id: string; category: string; name: string; description: string; price: number; ingredients: string; allergens: string;
  spiciness: number; soldOut?: boolean; recommended?: boolean; isNew?: boolean; imageTone: string; imageUrl?: string | null; maxPerOrder: number; options: OptionGroup[];
};

export const categories = ["すべて", "ごはん", "軽食", "ドリンク"];

export const sampleMenu: MenuItem[] = [
  { id: "rice-01", category: "ごはん", name: "とり天丼", description: "サクサクのとり天をごはんにのせた定番メニュー。", price: 500, ingredients: "店舗へお問い合わせください", allergens: "確認中", spiciness: 0, recommended: true, imageTone: "toriten", maxPerOrder: 10, options: [] },
  { id: "rice-02", category: "ごはん", name: "とり天南蛮丼", description: "とり天に自家製タルタルソースを合わせた人気メニュー。", price: 590, ingredients: "店舗へお問い合わせください", allergens: "確認中", spiciness: 0, recommended: true, imageTone: "nanban", maxPerOrder: 10, options: [] },
  { id: "side-01", category: "軽食", name: "フィッシュドッグ", description: "マグロの希少部位をはさんだ軽食メニュー。", price: 290, ingredients: "店舗へお問い合わせください", allergens: "確認中", spiciness: 0, imageTone: "fishdog", maxPerOrder: 10, options: [] },
];

export const locations = [
  { id: "loc-today", name: "当日の出店場所", address: "Instagramでご確認ください", mapUrl: "https://www.instagram.com/kitchencar_life.aki/" },
];

export function createPickupTimes(): string[] {
  const values: string[] = [];
  for (let minutes = 11 * 60 + 30; minutes <= 14 * 60; minutes += 15) {
    values.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return values;
}
