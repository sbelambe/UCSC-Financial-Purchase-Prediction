from src.load_data import load_all_data
from src.clean_amazon import clean_amazon
from src.clean_pcard import clean_pcard
from src.clean_cruzbuy import clean_cruzbuy

def main():
    amazon = clean_amazon("data/raw/amazon.csv")
    pcard = clean_pcard("data/raw/pcard.csv")
    cruzbuy = clean_cruzbuy("data/raw/cruzbuy.csv")

    # amazon.to_csv("data/clean/amazon_clean.csv", index=False)
    # pcard.to_csv("data/clean/pcard_clean.csv", index=False)
    # cruzbuy.to_csv("data/clean/cruzbuy_clean.csv", index=False)

if __name__ == "__main__":
    main()