import {
  Activity,
  AirVent,
  Archive,
  Armchair,
  AudioLines,
  Backpack,
  Bath,
  BatteryCharging,
  Bed,
  BedDouble,
  BedSingle,
  Bike,
  Blinds,
  Boxes,
  BrushCleaning,
  Camera,
  Coffee,
  Container,
  CookingPot,
  CupSoda,
  Dumbbell,
  Drone,
  Droplets,
  Fan,
  Flame,
  FlaskConical,
  Footprints,
  Frame,
  Gamepad2,
  Gem,
  Glasses,
  GlassWater,
  HardDrive,
  Headphones,
  HeartPulse,
  Heater,
  House,
  Keyboard,
  LampCeiling,
  LampDesk,
  Laptop,
  Library,
  Microwave,
  Monitor,
  MonitorSmartphone,
  Mouse,
  Palette,
  Printer,
  Projector,
  Refrigerator,
  Router,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Smile,
  Sofa,
  Sparkles,
  Speaker,
  SprayCan,
  Tablet,
  Tent,
  Trophy,
  Tv,
  Utensils,
  UtensilsCrossed,
  WashingMachine,
  Watch,
  Wind
} from "lucide-react";

// Main categories (departments) and the product types inside each.
// Category names must be unique and match CATEGORY_QUERIES in backend/server.js.
export const DEPARTMENTS = [
  {
    name: "Electronics",
    icon: MonitorSmartphone,
    categories: [
      { name: "Smartphones", icon: Smartphone },
      { name: "Laptops", icon: Laptop },
      { name: "Tablets", icon: Tablet },
      { name: "Televisions", icon: Tv },
      { name: "Monitors", icon: Monitor },
      { name: "Headphones", icon: Headphones },
      { name: "Earbuds", icon: AudioLines },
      { name: "Speakers", icon: Speaker },
      { name: "Smartwatches", icon: Watch },
      { name: "Cameras", icon: Camera },
      { name: "Gaming", icon: Gamepad2 },
      { name: "Printers", icon: Printer },
      { name: "Keyboards", icon: Keyboard },
      { name: "Mice", icon: Mouse },
      { name: "Routers", icon: Router },
      { name: "Power Banks", icon: BatteryCharging },
      { name: "Storage", icon: HardDrive },
      { name: "Projectors", icon: Projector },
      { name: "Drones", icon: Drone }
    ]
  },
  {
    name: "Home Appliances",
    icon: Refrigerator,
    categories: [
      { name: "Air Conditioners", icon: AirVent },
      { name: "Refrigerators", icon: Refrigerator },
      { name: "Washing Machines", icon: WashingMachine },
      { name: "Microwaves", icon: Microwave },
      { name: "Fans", icon: Fan },
      { name: "Water Purifiers", icon: GlassWater },
      { name: "Vacuum Cleaners", icon: BrushCleaning },
      { name: "Air Purifiers", icon: Wind },
      { name: "Geysers", icon: Heater }
    ]
  },
  {
    name: "Furniture",
    icon: Sofa,
    categories: [
      { name: "Sofas", icon: Sofa },
      { name: "Beds", icon: BedDouble },
      { name: "Mattresses", icon: BedSingle },
      { name: "Office Chairs", icon: Armchair },
      { name: "Study Tables", icon: LampDesk },
      { name: "Wardrobes", icon: Archive },
      { name: "Bookshelves", icon: Library }
    ]
  },
  {
    name: "Home Essentials",
    icon: House,
    categories: [
      { name: "Bedsheets", icon: Bed },
      { name: "Curtains", icon: Blinds },
      { name: "Lighting", icon: LampCeiling },
      { name: "Home Decor", icon: Frame },
      { name: "Storage Organisers", icon: Boxes },
      { name: "Cleaning Supplies", icon: SprayCan },
      { name: "Bath Towels", icon: Bath }
    ]
  },
  {
    name: "Kitchen & Dining",
    icon: CookingPot,
    categories: [
      { name: "Cookware", icon: CookingPot },
      { name: "Mixer Grinders", icon: Utensils },
      { name: "Pressure Cookers", icon: Flame },
      { name: "Dinner Sets", icon: UtensilsCrossed },
      { name: "Water Bottles", icon: CupSoda },
      { name: "Coffee Makers", icon: Coffee },
      { name: "Kitchen Storage", icon: Container }
    ]
  },
  {
    name: "Fashion",
    icon: Shirt,
    categories: [
      { name: "Men's Clothing", icon: Shirt },
      { name: "Women's Clothing", icon: ShoppingBag },
      { name: "Footwear", icon: Footprints },
      { name: "Watches", icon: Watch },
      { name: "Bags", icon: Backpack },
      { name: "Sunglasses", icon: Glasses },
      { name: "Jewellery", icon: Gem }
    ]
  },
  {
    name: "Beauty & Personal Care",
    icon: Sparkles,
    categories: [
      { name: "Trimmers", icon: Scissors },
      { name: "Hair Dryers", icon: Wind },
      { name: "Skincare", icon: Droplets },
      { name: "Perfumes", icon: FlaskConical },
      { name: "Makeup", icon: Palette },
      { name: "Electric Toothbrushes", icon: Smile }
    ]
  },
  {
    name: "Sports & Fitness",
    icon: Dumbbell,
    categories: [
      { name: "Dumbbells", icon: Dumbbell },
      { name: "Treadmills", icon: Activity },
      { name: "Cycles", icon: Bike },
      { name: "Yoga Mats", icon: HeartPulse },
      { name: "Cricket", icon: Trophy },
      { name: "Camping Gear", icon: Tent }
    ]
  }
];

// Every product type with its department, e.g. for lookups from the URL.
export const CATEGORIES = DEPARTMENTS.flatMap((department) =>
  department.categories.map((category) => ({
    ...category,
    department: department.name
  }))
);

export function findCategory(name) {
  return CATEGORIES.find((category) => category.name === name) || null;
}

export function findDepartment(name) {
  return DEPARTMENTS.find((department) => department.name === name) || null;
}
