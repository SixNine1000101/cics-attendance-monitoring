import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const BackButton = ({ label = "", destination }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (destination) {
      navigate(destination);
    } else {
      navigate(-1);
    }
  };

  return (
    <button onClick={handleClick} className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors">
      <ArrowLeftIcon className="h-6 w-6" />
      <span className="font-semibold">{label}</span>
    </button>
  );
};

export default BackButton;
