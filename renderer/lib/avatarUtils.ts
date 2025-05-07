// Avatar utility functions for the application
import Avatar1 from "../assets/avatars/Avatar-1.png";
import Avatar2 from "../assets/avatars/Avatar-2.png";
import Avatar3 from "../assets/avatars/Avatar-3.png";
import Avatar4 from "../assets/avatars/Avatar-4.png";
import Avatar5 from "../assets/avatars/Avatar-5.png";
import Avatar6 from "../assets/avatars/Avatar-6.png";
import Avatar7 from "../assets/avatars/Avatar-7.png";
import Avatar8 from "../assets/avatars/Avatar-8.png";
import Avatar9 from "../assets/avatars/Avatar-9.png";
import Avatar10 from "../assets/avatars/Avatar-10.png";
import Avatar11 from "../assets/avatars/Avatar-11.png";
import Avatar12 from "../assets/avatars/Avatar-12.png";

// Export the list of avatars for use in other components
export const avatars = [
  Avatar1,
  Avatar2,
  Avatar3,
  Avatar4,
  Avatar5,
  Avatar6,
  Avatar7,
  Avatar8,
  Avatar9,
  Avatar10,
  Avatar11,
  Avatar12,
];

/**
 * Get an avatar image based on an ID
 * @param id The ID to use for selecting an avatar (usually employee ID or index)
 * @returns The avatar image
 */
export const getAvatarByIndex = (id: string | number): any => {
  // Convert string ID to a number if necessary
  const numericId =
    typeof id === "string"
      ? // Hash the string to create a consistent number
        id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : id;

  // Use modulo to ensure we get a valid index
  const index = numericId % avatars.length;

  return avatars[index];
};

/**
 * Get all available avatars
 * @returns Array of all avatar images
 */
export const getAllAvatars = (): any[] => {
  return avatars;
};

/**
 * Generate employee card animation properties
 * Used for the floating employee cards in the login screen
 */
export const generateCardAnimationProps = () => {
  return {
    top: Math.random() * 80 + 5, // Random position between 5-85%
    left: Math.random() * 80 + 5,
    delay: Math.random() * 5, // Random animation delay
    duration: Math.random() * 10 + 20, // Random animation duration between 20-30s
    direction: Math.random() > 0.5 ? "normal" : "reverse", // Random direction
    rotate: Math.random() * 8 - 4, // Random rotation between -4 and 4 degrees
  };
};
