import axiosClient from "../api/axiosClient";

export const getImpuestos = async () => {
  const { data } = await axiosClient.get("/impuestos/");
  return data;
};
