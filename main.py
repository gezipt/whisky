import streamlit as st
import pandas as pd

df = pd.read_excel('scotch_cosine_similarity.xlsx')

names = list(df.columns)[1:]
dropdown_list = names.copy()
dropdown_list.insert(0, '<select>')


print(names)
print(len(df))
def get_most_similar(name_input):
    similar = pd.DataFrame({'name': names, 'similarity': list(df[name_input])})\
        .sort_values(by='similarity', ascending=False)\
        .iloc[1: , :]
    return similar



selected = st.selectbox('Choose Whisky', dropdown_list)

if selected != '<select>':
    st.dataframe(get_most_similar(selected))