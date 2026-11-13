"use client";
import React from "react";
import { FaFacebookF, FaInstagram, FaTwitter, FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom"; // change to 'next/link' if using Next.js

import { useEvents } from "@/hooks/useEvents";
import { useEventServices } from "@/hooks/useEventServices";

const Footer: React.FC = () => {
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: eventServices, isLoading: eventServicesLoading } = useEventServices();

  return (
    <footer
      className="flex flex-col items-center max-w-full mx-auto px-6 pt-12 pb-8 mt-20 w-full text-lg bg-neutral-50 max-md:mt-10"
      style={{
        background: "linear-gradient(135deg, #4b1248 30%, rgb(61 9 61) 100%)",
      }}
    >
      <div className="grid w-full max-w-[1575px] gap-10 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Logo + Social Media */}
        <div className="flex flex-col items-start font-semibold text-black">
          <div className="flex items-center space-x-2">
            <Link to="/">
            <img
              src="/jnvSpectraLogoBold.png"
              alt="JNV Spectra Logo"
              className="object-contain transition-all duration-300 h-28 md:h-28"
            />
            </Link>
          </div>

          <div className="mt-10 font-medium text-white">Social Media</div>
          <div className="flex space-x-4 mt-3">
            <a
              href="https://www.facebook.com/JNVSPECTRA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-stone-600 transition"
            >
              <FaFacebookF size={18} />
            </a>
            <a
              href="https://www.instagram.com/jnvspectra/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-stone-600 transition"
            >
              <FaInstagram size={18} />
            </a>
              <a
              href="https://Wa.me/+13527732872" // Replace with your actual WhatsApp number
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-stone-600 transition"
            >
              <FaWhatsapp size={18} />
            </a>
          </div>
          <div className="mt-4 text-white text-[15px] space-y-1">
            <p><a href="mailto:info@jnvspectra.com" className="hover:underline">info@jnvspectra.com</a></p>
            <p><a href="tel:+13527732872" className="hover:underline">+1 (352) 773-2872</a></p>
          </div>
        </div>


        {/* Event Planning */}
        <div className="flex flex-col text-white">
          <span className="font-medium text-[16px] capitalize">Event Planning</span>
          {eventsLoading ? (
            <span className="mt-2 text-[16px]">Loading...</span>
          ) : (
            events?.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.title.toLowerCase().replace(/\s+/g, "-")}`}
                state={{ id: event.id }}
                className="capitalize text-[16px] mt-2 hover:underline"
              >
                {event.title}
              </Link>
            ))
          )}
        </div>


        {/* Event Services */}
        <div className="flex flex-col text-white">
          <span className="font-medium text-[16px] capitalize">Event Services</span>
          {eventServicesLoading ? (
            <span className="mt-2 text-[16px]">Loading...</span>
          ) : (
            eventServices?.map((service) => (
              <Link
                key={service.id}
                to={`/eventServices/${service.title.toLowerCase().replace(/\s+/g, "-")}`}
                state={{ id: service.id }}
                className="capitalize text-[16px] mt-2 hover:underline"
              >
                {service.title}
              </Link>
            ))
          )}
        </div>

        

        {/* Quick Links */}
        <div className="flex flex-col text-white">
          <span className="font-medium text-[16px] capitalize">Quick Links</span>
          <Link to="/about">
            <span className="capitalize text-[16px] mt-2 hover:underline cursor-pointer">About Us</span>
          </Link>
          <Link to="/contact">
            <span className="capitalize text-[16px] hover:underline cursor-pointer">Contact Us</span>
          </Link>
          <Link to="/privacy-policy">
            <span className="capitalize text-[16px] hover:underline cursor-pointer">Privacy Policy</span>
          </Link>
          <Link to="/terms-and-conditions">
            <span className="capitalize text-[16px] hover:underline cursor-pointer">Terms & Conditions</span>
          </Link>
        </div>

        {/* Newsletter */}
        {/* <div className="flex flex-col items-start">
          <span className="font-semibold text-[16px] text-white">Newsletter</span>
          <span className="mt-4 text-[16px] text-white">Subscribe for latest updates</span>
          <div className="flex flex-wrap gap-2 mt-4 w-full">
            <input
              type="email"
              placeholder="Mark@mail.com"
              className="flex-1 px-4 py-3 text-base font-normal bg-gray-200 rounded-xl text-zinc-600 max-md:w-28"
            />
            <button
              className="px-6 py-3 font-medium text-sm text-white bg-stone-600 rounded-xl max-md:w-full"
              style={{
                background: "transparent",
                border: "1px solid rgb(253 207 106)",
                color: "rgb(253 207 106)",
              }}
            >
              Subscribe
            </button>
          </div>
        </div> */}
      </div>

      {/* Footer Credit */}
      <div className="mt-10 text-white text-[16px] text-center">
  © 2025 JNV SPECTRA. All rights reserved
</div>

    </footer>
  );
};

export default Footer;
